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
export function parseContact(phone: string | null | undefined, telegramUsername?: string | null) {
  if (!phone) {
    return { channel: 'direct' as ContactChannel, isBotContact: false, label: 'No contact given' };
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
  return { channel: 'direct' as ContactChannel, isBotContact: false, label: phone };
}

// CSV export wants a slightly more explicit string than the dashboard's
// compact label, but should still derive from the same parse rather than
// re-deriving the prefix logic a second time.
export function formatContactForExport(phone: string, telegramUsername?: string | null): string {
  const { channel, label } = parseContact(phone, telegramUsername);
  return channel === 'telegram' && telegramUsername ? `${label} (Telegram)` : label;
}
