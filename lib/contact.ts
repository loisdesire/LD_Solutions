// Pure string logic only - no Supabase/env access - so this is safe to
// import from both server code and client components. customer_phone
// doubles as an opaque per-channel identifier for chat bookings
// ('whatsapp:+234...' / 'telegram:<chatId>'), and this is the one place
// that knows how to turn that into something a human can read or act on,
// regardless of which surface is asking (dashboard table, CSV export, or
// an API route deciding which provider to send through).
export type ContactChannel = 'whatsapp' | 'telegram' | 'messenger' | 'direct';

// phone is nullable in the database (bookings.customer_phone) but was typed
// as a plain string, so every caller implicitly promised something the
// schema does not guarantee. One booking with no phone - which both the
// admin "new appointment" form and the API allow - crashed the ENTIRE
// dashboard with "Cannot read properties of null (reading 'startsWith')",
// because this runs once per booking in the list.
export function parseContact(phone: string | null | undefined, telegramUsername?: string | null, email?: string | null) {
  if (!phone) {
    return { channel: 'direct' as ContactChannel, isBotContact: false, label: email || 'No contact given' };
  }
  if (phone.startsWith('whatsapp:')) {
    return { channel: 'whatsapp' as ContactChannel, isBotContact: true, label: phone.slice('whatsapp:'.length) };
  }
  if (phone.startsWith('telegram:')) {
    const label = telegramUsername ? `@${telegramUsername}` : 'via Telegram';
    return { channel: 'telegram' as ContactChannel, isBotContact: true, label };
  }
  if (phone.startsWith('messenger:')) {
    return { channel: 'messenger' as ContactChannel, isBotContact: true, label: 'via Messenger' };
  }
  // Not a real reachable identity at all - resolveIdentity()
  // (app/api/web-chat/route.ts) falls back to `web:<sessionId>` for an
  // anonymous web-chat visitor, an opaque id only useful for threading
  // that browser session's own conversation server-side. Confirmed live:
  // this used to fall through to the plain `return` below and show the
  // raw "web:9beabfdd-..." string as if it were a real contact - worse
  // than showing nothing, since it doesn't even read as missing.
  // channel stays 'direct' (correct for send-reminders/message-customer:
  // there's no bot channel to push a message back through), but
  // isBotContact stays true - a real conversation for this session does
  // exist (same loadConversation/saveConversation as every other
  // channel), so the dashboard should open it, not attempt a bogus
  // tel: link with a UUID as the phone number. applyCreateBooking now
  // requires a real email before a web-chat booking with no verified
  // customer can be created at all, so `email` here should stop being
  // empty for anything booked from here on.
  if (phone.startsWith('web:')) {
    return { channel: 'direct' as ContactChannel, isBotContact: true, label: email || 'via web chat' };
  }
  return { channel: 'direct' as ContactChannel, isBotContact: false, label: phone };
}

// CSV export wants a slightly more explicit string than the dashboard's
// compact label, but should still derive from the same parse rather than
// re-deriving the prefix logic a second time.
export function formatContactForExport(phone: string, telegramUsername?: string | null, email?: string | null): string {
  const { channel, label } = parseContact(phone, telegramUsername, email);
  return channel === 'telegram' && telegramUsername ? `${label} (Telegram)` : label;
}
