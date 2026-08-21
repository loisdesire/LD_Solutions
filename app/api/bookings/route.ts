import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { todayInTimezone, daysBetween } from '@/lib/timezone';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { canAcceptBookings } from '@/lib/subscription-server';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { renderEmail } from '@/lib/emailTemplate';
import { SITE_URL } from '@/lib/site';

// Server-side only: the anon/publishable key's insert policy on bookings
// isn't resolving correctly in this project even though `with check (true)`
// is in place, so this route uses the service role key instead. Safe here
// because this code only ever runs on the server, and the fields inserted
// are explicitly whitelisted below, not passed through raw.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/bookings - creates a booking, then fires off a confirmation email.
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
    paymentReference,
  } = body;

  if (!businessId || !(await canAcceptBookings(businessId))) {
    return NextResponse.json(
      { error: 'This business isn\'t currently accepting online bookings. Please contact them directly.' },
      { status: 403 }
    );
  }

  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  // Enforce max_advance_days server-side too - the date picker already
  // caps this in the UI, but that's bypassable by calling this route
  // directly, so re-check the same rule here. Measured in the business's
  // own timezone, not the server's, so this stays correct after deploy.
  let [{ data: rules }, { data: business }, { data: service }] = await Promise.all([
    supabaseAdmin
      .from('booking_rules')
      .select('webhook_url, max_advance_days, require_payment, deposit_percentage')
      .eq('business_id', businessId)
      .maybeSingle(),
    supabaseAdmin.from('businesses').select('timezone, paystack_secret_key, name, accent_color, logo_url, slug').eq('id', businessId).single(),
    supabaseAdmin.from('services').select('price, name').eq('id', serviceId).maybeSingle(),
  ]);

  // A Postgres select fails as one unit if ANY selected column is
  // missing, not just the new ones - so before the payments migration
  // runs, that combined query above silently loses webhook_url and
  // max_advance_days too, not just the payment fields. Falls back to the
  // pre-payments column set rather than let real, already-configured
  // settings (advance-booking window, webhook) quietly revert to
  // defaults in the meantime.
  if (rules === null) {
    const fallback = await supabaseAdmin
      .from('booking_rules')
      .select('webhook_url, max_advance_days')
      .eq('business_id', businessId)
      .maybeSingle();
    if (fallback.data) rules = { ...fallback.data, require_payment: false, deposit_percentage: null };
  }
  if (business === null) {
    const fallback = await supabaseAdmin.from('businesses').select('timezone, name, accent_color, logo_url, slug').eq('id', businessId).single();
    if (fallback.data) business = { ...fallback.data, paystack_secret_key: null };
  }

  const timeZone = business?.timezone || 'UTC';
  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  const today = todayInTimezone(timeZone);
  const startDateInTz = new Intl.DateTimeFormat('en-CA', { timeZone }).format(start);
  const daysOut = daysBetween(today, startDateInTz);

  if (daysOut < 0 || daysOut > maxAdvanceDays) {
    return NextResponse.json({ error: 'That date is not available for booking' }, { status: 400 });
  }

  // Payment gate - only when the business has turned this on AND actually
  // has a price on the service; a free/unpriced service can't require
  // payment no matter what the toggle says. Verified against Paystack
  // directly rather than trusting whatever the client claims it paid -
  // the client only ever hands us a reference, never an amount or a
  // "paid" flag we'd have to take on faith.
  let paymentStatus: string | null = null;
  let amountPaid: number | null = null;

  if (rules?.require_payment && service?.price) {
    if (!business?.paystack_secret_key) {
      logError('api/bookings:payment-misconfigured', new Error('require_payment is on with no Paystack key'), { businessId });
      return NextResponse.json({ error: 'This business hasn\'t finished setting up payments. Please contact them directly.' }, { status: 503 });
    }
    if (!paymentReference) {
      return NextResponse.json({ error: 'Payment is required to book this service.' }, { status: 402 });
    }

    const expectedNaira = Math.round(service.price * ((rules.deposit_percentage ?? 100) / 100));
    const expectedKobo = expectedNaira * 100;

    const verified = await verifyPaystackTransaction(business.paystack_secret_key, paymentReference);
    // A few naira of rounding slack, not an exact-match requirement -
    // Paystack's own fee handling can shift the settled amount by a kobo
    // or two even when the customer paid the right thing.
    if (!verified || verified.status !== 'success' || Math.abs(verified.amount - expectedKobo) > 200) {
      logError('api/bookings:payment-verify-failed', new Error('Payment verification failed'), {
        businessId, paymentReference, expectedKobo, got: verified,
      });
      return NextResponse.json({ error: 'We couldn\'t verify that payment. Please try again.' }, { status: 402 });
    }

    paymentStatus = 'paid';
    amountPaid = expectedNaira;
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
      payment_status: paymentStatus,
      payment_reference: paymentStatus ? paymentReference : null,
      amount_paid: amountPaid,
    })
    .select()
    .single();

  if (error) {
    // 23P01 = Postgres exclusion_violation - the DB-level guarantee that no
    // two non-cancelled bookings for the same business can overlap in time.
    // This is what actually closes the race condition two customers could
    // hit booking the same slot at the same moment; everything upstream
    // (the availability check) is just the fast path / good UX.
    if ((error as { code?: string }).code === '23P01') {
      return NextResponse.json({ error: 'That time is no longer available' }, { status: 409 });
    }
    logError('api/bookings:insert', error, { businessId, serviceId });
    // Raw Postgres text is logged, not shown - this is a public endpoint.
    return NextResponse.json(
      { error: "We couldn't complete that booking. Please try again, or contact the business directly." },
      { status: 400 }
    );
  }

  // Fire-and-forget webhook, if the business has one configured (Zapier,
  // Make, their own CRM - anything that accepts a POST).
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

  // Fire-and-forget confirmation email - never fails the booking itself.
  // Formatted in the business's own timezone, not the server's - a real
  // bug this was hitting before: a booking confirmed for "8:00 AM" Lagos
  // time could show a different hour in the email if the server (e.g. a
  // US-region Vercel deploy) runs in a different zone.
  if (customerEmail) {
    const whenLabel = start.toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' });
    const bizName = business?.name ?? 'Your appointment';

    const rows = [
      { label: 'Service', value: service?.name ?? 'Appointment' },
      { label: 'When', value: whenLabel },
    ];
    if (amountPaid) rows.push({ label: 'Paid', value: `₦${amountPaid.toLocaleString()}` });

    await sendEmail(
      {
        to: customerEmail,
        subject: `Your ${bizName} appointment is confirmed`,
        html: renderEmail({
          businessName: bizName,
          accentColor: business?.accent_color,
          logoUrl: business?.logo_url,
          preheader: `${service?.name ?? 'Your appointment'} - ${whenLabel}`,
          heading: "You're booked",
          intro: `Hi ${customerName}, your appointment is confirmed. Here are the details.`,
          rows,
          cta: business?.slug
            ? { label: 'Manage this booking', url: `${SITE_URL}/${business.slug}/manage/${booking.id}` }
            : null,
          footerNote: 'Need to reschedule or cancel? Use the link above.',
        }),
      },
      'api/bookings:confirmation-email',
      { businessId }
    );
  }

  return NextResponse.json({ booking });
}
