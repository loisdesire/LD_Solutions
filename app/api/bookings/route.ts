import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { todayInTimezone, daysBetween } from '@/lib/timezone';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';

// Server-side only: the anon/publishable key's insert policy on bookings
// isn't resolving correctly in this project even though `with check (true)`
// is in place, so this route uses the service role key instead. Safe here
// because this code only ever runs on the server, and the fields inserted
// are explicitly whitelisted below, not passed through raw.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/bookings — creates a booking, then fires off a confirmation email.
// Centralizing this in an API route (rather than calling Supabase directly
// from the browser) is what lets us also trigger email/SMS in one place.
export async function POST(req: NextRequest) {
  if (!rateLimit(`booking:${getClientIp(req)}`, 8, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const body = await req.json();
  const {
    businessId,
    serviceId,
    customerName,
    customerEmail,
    customerPhone,
    startTime,
    durationMinutes,
  } = body;

  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  // Enforce max_advance_days server-side too — the date picker already
  // caps this in the UI, but that's bypassable by calling this route
  // directly, so re-check the same rule here. Measured in the business's
  // own timezone, not the server's, so this stays correct after deploy.
  const [{ data: rules }, { data: business }] = await Promise.all([
    supabaseAdmin
      .from('booking_rules')
      .select('webhook_url, max_advance_days')
      .eq('business_id', businessId)
      .maybeSingle(),
    supabaseAdmin.from('businesses').select('timezone').eq('id', businessId).single(),
  ]);

  const timeZone = business?.timezone || 'UTC';
  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  const today = todayInTimezone(timeZone);
  const startDateInTz = new Intl.DateTimeFormat('en-CA', { timeZone }).format(start);
  const daysOut = daysBetween(today, startDateInTz);

  if (daysOut < 0 || daysOut > maxAdvanceDays) {
    return NextResponse.json({ error: 'That date is not available for booking' }, { status: 400 });
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      business_id: businessId,
      service_id: serviceId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    })
    .select()
    .single();

  if (error) {
    // 23P01 = Postgres exclusion_violation — the DB-level guarantee that no
    // two non-cancelled bookings for the same business can overlap in time.
    // This is what actually closes the race condition two customers could
    // hit booking the same slot at the same moment; everything upstream
    // (the availability check) is just the fast path / good UX.
    if ((error as { code?: string }).code === '23P01') {
      return NextResponse.json({ error: 'That time is no longer available' }, { status: 409 });
    }
    logError('api/bookings:insert', error, { businessId, serviceId });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fire-and-forget webhook, if the business has one configured (Zapier,
  // Make, their own CRM — anything that accepts a POST).
  if (rules?.webhook_url) {
    try {
      await fetch(rules.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'booking.created', booking }),
      });
    } catch (err) {
      logError('api/bookings:webhook', err, { businessId, webhookUrl: rules.webhook_url });
    }
  }

  // Fire-and-forget confirmation email — never fails the booking itself.
  // Formatted in the business's own timezone, not the server's — a real
  // bug this was hitting before: a booking confirmed for "8:00 AM" Lagos
  // time could show a different hour in the email if the server (e.g. a
  // US-region Vercel deploy) runs in a different zone.
  if (customerEmail) {
    await sendEmail(
      {
        to: customerEmail,
        subject: 'Your appointment is confirmed',
        html: `<p>Hi ${customerName}, your appointment is confirmed for ${start.toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' })}.</p>`,
      },
      'api/bookings:confirmation-email',
      { businessId }
    );
  }

  return NextResponse.json({ booking });
}
