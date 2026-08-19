import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { sendTelegramMessage, sendWhatsappMessage, sendMessengerMessage } from '@/lib/channelSend';
import { parseContact } from '@/lib/contact';
import { loadConversation, saveConversation, type ChatMessage } from '@/lib/whatsappTools';
import { MAX_HISTORY } from '@/lib/whatsappAgent';
import { getNotifyCreds } from '@/lib/notifyCustomer';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// GET /api/admin/message-customer?slug=...&customerPhone=... — the same
// history the AI agent already reads for context (lib/whatsappTools.ts
// loadConversation), surfaced to the business owner so replying isn't a
// blind message into a conversation they can't see.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  const customerPhone = req.nextUrl.searchParams.get('customerPhone');
  if (!slug || !customerPhone) {
    return NextResponse.json({ error: 'Missing slug or customerPhone' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(slug);
  if (auth.error) return auth.error;

  const messages = await loadConversation(auth.business.id, customerPhone);
  return NextResponse.json({ messages });
}

// POST /api/admin/message-customer — lets the business owner reply to a
// customer through the SAME bot identity (WhatsApp number or Telegram bot)
// the customer already has an open conversation with. Deliberately not a
// "message their personal number/account" flow (e.g. wa.me/t.me links) —
// a WhatsApp Business API number can't double as a normal consumer WhatsApp
// account on someone's phone, so that would always send from a different,
// unrecognized number. This sends as the actual bot, continuing the same
// thread, which is what escalation from the bot to a human should look like.
export async function POST(req: NextRequest) {
  if (!rateLimit(`admin-message:${getClientIp(req)}`, 20, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, customerPhone, message } = await req.json();
  if (!slug || typeof customerPhone !== 'string' || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Missing slug, customerPhone, or message' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(slug, 'id');
  if (auth.error) return auth.error;
  // Fetched separately (rather than in the same select as the auth check)
  // because whatsapp_access_token is currently missing from the live
  // database (documented in schema.sql, evidently never actually applied)
  // — combining it into one select would fail the whole query and make
  // Telegram/Messenger replies break too, not just WhatsApp. getNotifyCreds
  // already degrades gracefully for exactly this case.
  const business = await getNotifyCreds(auth.business.id);

  const { channel } = parseContact(customerPhone);

  if (channel === 'whatsapp' && (!business.whatsapp_phone_number_id || !business.whatsapp_access_token)) {
    return NextResponse.json({ error: 'No WhatsApp number connected for this business.' }, { status: 400 });
  }
  if (channel === 'telegram' && !business.telegram_bot_token) {
    return NextResponse.json({ error: 'No Telegram bot connected for this business.' }, { status: 400 });
  }
  if (channel === 'messenger' && !business.messenger_access_token) {
    return NextResponse.json({ error: 'No Messenger page connected for this business.' }, { status: 400 });
  }
  if (channel === 'direct') {
    return NextResponse.json(
      { error: 'This contact can only be reached directly (phone/email), not through the bot.' },
      { status: 400 }
    );
  }

  const sendPromise =
    channel === 'whatsapp'
      ? sendWhatsappMessage(
          business.whatsapp_access_token!,
          business.whatsapp_phone_number_id,
          customerPhone,
          message
        )
      : channel === 'messenger'
      ? sendMessengerMessage(business.messenger_access_token!, customerPhone.slice('messenger:'.length), message)
      : sendTelegramMessage(business.telegram_bot_token, customerPhone.slice('telegram:'.length), message);

  // Sending and reading current history are independent — no reason to
  // wait for one before starting the other. Only the decision to *save*
  // depends on the send having actually succeeded.
  const [sent, history] = await Promise.all([sendPromise, loadConversation(auth.business.id, customerPhone)]);

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send after retrying. Please try again shortly.' }, { status: 502 });
  }

  const newTurn: ChatMessage = { role: 'assistant', content: message };
  const updated = [...history, newTurn].slice(-MAX_HISTORY);
  await saveConversation(auth.business.id, customerPhone, updated);

  return NextResponse.json({ sent: true });
}
