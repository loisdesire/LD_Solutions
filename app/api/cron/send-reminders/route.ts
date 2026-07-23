import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REMINDER_WINDOW_HOURS = 24;
const BATCH_SIZE = 10; // concurrent sends — bounded so a large backlog doesn't all hit Resend at once

// GET /api/cron/send-reminders — triggered by Vercel Cron (see vercel.json).
// Channel-agnostic on purpose: it doesn't care whether the booking came
// from the web form, WhatsApp, or Telegram, only that it has an email and
// hasn't been reminded yet. Safe to run as often as the hosting plan
// allows — reminder_sent_at makes every booking eligible exactly once,
// regardless of how many times this runs before or after that.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 3600_000).toISOString();

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select('id, customer_name, customer_email, start_time, services(name), businesses(name, timezone)')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .not('customer_email', 'is', null)
    .gte('start_time', new Date().toISOString())
    .lte('start_time', windowEnd)
    .limit(100);

  if (error) {
    logError('cron/send-reminders:query', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // No key configured yet: leave every booking untouched (reminder_sent_at
  // stays null) so they're still eligible and get a real reminder once
  // RESEND_API_KEY is set, rather than silently marking them "sent" now.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ checked: bookings?.length ?? 0, sent: 0, failed: 0, skipped: 'RESEND_API_KEY not configured' });
  }

  let sent = 0;
  let failed = 0;

  async function remindOne(booking: NonNullable<typeof bookings>[number]) {
    const service = booking.services as unknown as { name: string } | null;
    const business = booking.businesses as unknown as { name: string; timezone: string } | null;
    const startLabel = new Date(booking.start_time).toLocaleString(undefined, {
      timeZone: business?.timezone || 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // A rejected send (bad address, restricted recipient, rate limit) is
    // treated as a failure so reminder_sent_at stays unset and the next
    // run retries it, instead of silently marking a failed send as sent.
    const ok = await sendEmail(
      {
        to: booking.customer_email!,
        subject: `Reminder: your appointment at ${business?.name ?? 'the business'}`,
        html: `<p>Hi ${booking.customer_name}, just a reminder that your ${service?.name ?? 'appointment'} at ${business?.name ?? ''} is coming up on ${startLabel}.</p>`,
      },
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
  // parallel batches rather than one at a time — bounded so a large
  // backlog doesn't fire 100 concurrent requests at Resend at once.
  const rows = bookings ?? [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await Promise.all(rows.slice(i, i + BATCH_SIZE).map(remindOne));
  }

  return NextResponse.json({ checked: bookings?.length ?? 0, sent, failed });
}
