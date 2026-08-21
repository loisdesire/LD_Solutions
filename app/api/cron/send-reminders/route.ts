import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';
import { notifyCustomer } from '@/lib/notifyCustomer';
import { parseContact } from '@/lib/contact';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REMINDER_WINDOW_HOURS = 24;
const BATCH_SIZE = 10; // concurrent sends - bounded so a large backlog doesn't all hit a provider at once

// GET /api/cron/send-reminders - triggered by Vercel Cron (see vercel.json).
// Reminds a customer through whichever channel they actually booked
// through - email for a direct web booking, the business's own connected
// Telegram/WhatsApp/Messenger bot for a chat booking - rather than only
// ever emailing, which silently reminded nobody who booked through a bot
// with no email on file. reminder_sent_at still makes every booking
// eligible exactly once, regardless of which channel actually sent it.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 3600_000).toISOString();

  // whatsapp_access_token deliberately isn't in this select - it's
  // currently missing from the live database (documented in schema.sql as
  // migrated, but live-verified never actually applied), and a combined
  // select naming it fails the WHOLE query, taking every channel's
  // reminders down at once, not just WhatsApp's. Fetched separately below,
  // only for businesses that might need it.
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, customer_name, customer_email, customer_phone, customer_telegram_username, start_time, services(name), businesses(id, name, timezone, telegram_bot_token, whatsapp_phone_number_id, messenger_access_token)'
    )
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('start_time', new Date().toISOString())
    .lte('start_time', windowEnd)
    .limit(100);

  if (error) {
    logError('cron/send-reminders:query', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = bookings ?? [];

  // One extra query for the whole batch, scoped to only the businesses
  // that look WhatsApp-connected (have a phone_number_id) - not one query
  // per booking. Empty map (rather than throwing) if the column is still
  // missing, which just means every business resolves to "no WhatsApp
  // token," the correct behavior until that migration runs.
  const waBusinessIds = [
    ...new Set(
      rows
        .map((b) => (Array.isArray(b.businesses) ? b.businesses[0] : b.businesses) as { id: string; whatsapp_phone_number_id: string | null } | null)
        .filter((biz) => Boolean(biz?.whatsapp_phone_number_id))
        .map((biz) => biz!.id)
    ),
  ];
  const waTokenByBusinessId = new Map<string, string | null>();
  if (waBusinessIds.length > 0) {
    const { data: waRows, error: waError } = await supabaseAdmin
      .from('businesses')
      .select('id, whatsapp_access_token')
      .in('id', waBusinessIds);
    if (!waError) {
      for (const row of waRows ?? []) waTokenByBusinessId.set(row.id, row.whatsapp_access_token);
    }
    // waError (42703) just leaves the map empty - every business below
    // falls back to `null`, i.e. "not connected," rather than erroring.
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  async function remindOne(booking: NonNullable<typeof bookings>[number]) {
    const service = booking.services as unknown as { name: string } | null;
    const businessRow = booking.businesses as unknown as
      | { id: string; name: string; timezone: string; telegram_bot_token: string | null; whatsapp_phone_number_id: string | null; messenger_access_token: string | null }
      | null;
    const business = businessRow
      ? { ...businessRow, whatsapp_access_token: waTokenByBusinessId.get(businessRow.id) ?? null }
      : null;
    const startLabel = new Date(booking.start_time).toLocaleString(undefined, {
      timeZone: business?.timezone || 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const text = `Hi ${booking.customer_name}, just a reminder that your ${service?.name ?? 'appointment'} at ${business?.name ?? ''} is coming up on ${startLabel}.`;

    // Distinguishes "nothing was actually attempted" (skipped, not a
    // failure worth alerting on) from "attempted and it didn't go
    // through" (failed) - a booking with only a bare phone number and no
    // email, no bot channel connected, has nowhere to actually send to.
    const { channel } = booking.customer_phone ? parseContact(booking.customer_phone, booking.customer_telegram_username) : { channel: 'direct' as const };
    const hasBotChannel =
      (channel === 'telegram' && business?.telegram_bot_token) ||
      (channel === 'whatsapp' && business?.whatsapp_access_token && business?.whatsapp_phone_number_id) ||
      (channel === 'messenger' && business?.messenger_access_token);
    if (!hasBotChannel && !booking.customer_email) {
      // Nothing eligible to send through - not connected, or no contact
      // info at all. Leave reminder_sent_at null so it's picked up again
      // once the underlying reason is fixed, but don't count it as a
      // failure (nothing was actually attempted).
      skipped += 1;
      return;
    }

    // A rejected/failed send of any kind is treated as a failure so
    // reminder_sent_at stays unset and the next run retries it, instead of
    // silently marking a failed send as sent.
    const ok = await notifyCustomer(
      business ?? { telegram_bot_token: null, whatsapp_access_token: null, whatsapp_phone_number_id: null, messenger_access_token: null },
      booking,
      text,
      `Reminder: your appointment at ${business?.name ?? 'the business'}`,
      'cron/send-reminders:send',
      { bookingId: booking.id }
    );

    if (ok) {
      await supabaseAdmin.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', booking.id);
      sent += 1;
    } else {
      failed += 1;
    }
  }

  // Each booking's send+update is independent of the others, so process in
  // parallel batches rather than one at a time - bounded so a large
  // backlog doesn't fire 100 concurrent requests at a provider at once.
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await Promise.all(rows.slice(i, i + BATCH_SIZE).map(remindOne));
  }

  return NextResponse.json({ checked: rows.length, sent, failed, skipped });
}
