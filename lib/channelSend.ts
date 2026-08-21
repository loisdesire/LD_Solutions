import { logError } from './logger';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A real bug traced back to an earlier version of this code: the AI would
// generate the correct reply and save it, but a single transient network
// blip calling out to Telegram/Twilio meant that reply never reached the
// customer - they'd see a generic fallback instead, even though the right
// answer was sitting in the database the whole time. Retrying a couple of
// times, and checking the provider's own response instead of only catching
// network-level exceptions, closes that gap. Shared by the webhook route
// (agent replies) and the admin "message this customer" route (human
// replies) - the same failure mode applies to both, so the fix needs to
// live in one place, not be re-patched per call site.
export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  attempts = 3
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.ok) return true;
      logError('channelSend:telegram', new Error(`Telegram responded ${res.status}: ${JSON.stringify(result)}`), {
        chatId,
        attempt: i + 1,
      });
    } catch (err) {
      logError('channelSend:telegram', err, { chatId, attempt: i + 1 });
    }
    if (i < attempts - 1) await sleep(500 * (i + 1));
  }
  return false;
}

// Meta's Cloud API, not Twilio - `to` is expected in this codebase's usual
// 'whatsapp:+234...' internal format (same as customer_phone everywhere
// else), and this strips it down to the bare-digits form Meta's Graph API
// actually wants (no 'whatsapp:' prefix, no leading '+') so every other
// call site can keep using the one consistent format.
export async function sendWhatsappMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  body: string,
  attempts = 3
): Promise<boolean> {
  const recipient = to.replace(/^whatsapp:/, '').replace(/^\+/, '');

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body },
        }),
      });
      if (res.ok) return true;
      logError('channelSend:whatsapp', new Error(`Meta Graph API responded ${res.status}: ${await res.text()}`), {
        to,
        attempt: i + 1,
      });
    } catch (err) {
      logError('channelSend:whatsapp', err, { to, attempt: i + 1 });
    }
    if (i < attempts - 1) await sleep(500 * (i + 1));
  }
  return false;
}

// Facebook Messenger Send API - `psid` is the customer's page-scoped ID
// from the webhook payload (sender.id), not a phone number. Uses a Page
// Access Token, unlike WhatsApp's phone-number-scoped token.
export async function sendMessengerMessage(
  pageAccessToken: string,
  psid: string,
  text: string,
  attempts = 3
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: psid },
            message: { text },
          }),
        }
      );
      if (res.ok) return true;
      logError('channelSend:messenger', new Error(`Meta Graph API responded ${res.status}: ${await res.text()}`), {
        psid,
        attempt: i + 1,
      });
    } catch (err) {
      logError('channelSend:messenger', err, { psid, attempt: i + 1 });
    }
    if (i < attempts - 1) await sleep(500 * (i + 1));
  }
  return false;
}
