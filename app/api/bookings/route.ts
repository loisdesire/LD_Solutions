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
import { formatMoney } from '@/lib/formatMoney';
import { notifyStaffOfNewBooking } from '@/lib/pushNotify';
import { pickAvailableStaffId } from '@/lib/assignStaff';
import {
  cleanEmail,
  cleanIsoInstant,
  cleanPhone,
  cleanRequiredText,
  cleanOptionalText,
  isUuid,
} from '@/lib/apiValidation';

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
  if (!(await rateLimit(`booking:${getClientIp(req)}`, 8, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
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

  const validName = cleanRequiredText(customerName, 100);
  const validEmail = cleanEmail(customerEmail, true);
  const validPhone = cleanPhone(customerPhone, true);
  const validStartTime = cleanIsoInstant(startTime);
  const validPaymentReference = cleanOptionalText(paymentReference, 160);

  if (
    !isUuid(businessId) ||
    !isUuid(serviceId) ||
    !validName ||
    validEmail === undefined ||
    validPhone === undefined ||
    !validStartTime
  ) {
    return NextResponse.json({ error: 'Invalid booking details' }, { status: 400 });
  }

  if (!(await canAcceptBookings(businessId))) {
    return NextResponse.json(
      { error: 'This business isn\'t currently accepting online bookings. Please contact them directly.' },
      { status: 403 }
    );
  }

  const start = new Date(validStartTime);

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
    supabaseAdmin
      .from('services')
      .select('price, name, duration_minutes')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .eq('active', true)
      .maybeSingle(),
  ]);

  if (!service) {
    return NextResponse.json({ error: 'That service is not available for this business.' }, { status: 400 });
  }

  // The client's durationMinutes was previously trusted outright and used
  // to compute end_time - a request that sent a short/zero/negative value
  // for a real service produced a booking whose stored end_time didn't
  // match the service's actual length, which is exactly what the
  // exclusion-constraint/availability-check machinery relies on being
  // correct: a manipulated duration made the slot immediately after this
  // booking look free when it wasn't, defeating the double-booking
  // protection. The service's own duration is the only value trusted now;
  // whatever the client sent is ignored (kept here only so callers that
  // still send it don't error on an unused field).
  void durationMinutes;
  const end = new Date(start.getTime() + service.duration_minutes * 60000);

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
    if (!validPaymentReference) {
      return NextResponse.json({ error: 'Payment is required to book this service.' }, { status: 402 });
    }

    const expectedNaira = Math.round(service.price * ((rules.deposit_percentage ?? 100) / 100));
    const expectedKobo = expectedNaira * 100;

    const verified = await verifyPaystackTransaction(business.paystack_secret_key, validPaymentReference);
    // A few naira of rounding slack, not an exact-match requirement -
    // Paystack's own fee handling can shift the settled amount by a kobo
    // or two even when the customer paid the right thing.
    if (!verified || verified.status !== 'success' || Math.abs(verified.amount - expectedKobo) > 200) {
      logError('api/bookings:payment-verify-failed', new Error('Payment verification failed'), {
        businessId, paymentReference: validPaymentReference, expectedKobo, got: verified,
      });
      return NextResponse.json({ error: 'We couldn\'t verify that payment. Please try again.' }, { status: 402 });
    }

    paymentStatus = 'paid';
    amountPaid = expectedNaira;
  }

  // Picks whichever staff member is actually free for this window - see
  // lib/assignStaff.ts. No staff free (every one of them already has a
  // conflicting booking) reads the same as "the slot's gone": the
  // availability check that offered this time should already have
  // excluded it once every staff member was accounted for, so reaching
  // this with nobody free means it was taken in the gap between that
  // check and this request, same race the exclusion constraint below
  // also guards against.
  const assignedStaffId = await pickAvailableStaffId(businessId, start.toISOString(), end.toISOString());
  if (!assignedStaffId) {
    return NextResponse.json({ error: 'That time is no longer available' }, { status: 409 });
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      business_id: businessId,
      service_id: serviceId,
      staff_id: assignedStaffId,
      customer_name: validName,
      customer_email: validEmail,
      customer_phone: validPhone,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      payment_status: paymentStatus,
      payment_reference: paymentStatus ? validPaymentReference : null,
      amount_paid: amountPaid,
    })
    .select()
    .single();

  if (error) {
    // 23P01 = Postgres exclusion_violation - the DB-level guarantee that no
    // two non-cancelled bookings for the same staff member can overlap in
    // time (see supabase/schema.sql - staff-scoped now, not business-wide).
    // This is what actually closes the race condition two customers could
    // hit booking the same staff member's slot at the same moment;
    // everything upstream (the availability check, the pickAvailableStaffId
    // call above) is just the fast path / good UX.
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

  // Formatted in the business's own timezone, not the server's - a real bug
  // this was hitting before: a booking confirmed for "8:00 AM" Lagos time
  // could show a different hour if the server (e.g. a US-region Vercel
  // deploy) runs in a different zone. Shared between the customer's
  // confirmation email below and the business's push notification.
  const whenLabel = start.toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' });

  // Never blocks or fails the booking itself - notifyStaffOfNewBooking
  // already catches per-device send failures internally; this try/catch is
  // only for the (unlikely) case its own DB lookups throw.
  try {
    await notifyStaffOfNewBooking(businessId, {
      customerName: validName,
      serviceName: service?.name ?? 'Appointment',
      whenLabel,
    });
  } catch (err) {
    logError('api/bookings:push-notify', err, { businessId });
  }

  // Awaited, but never fails the booking itself - sendEmail swallows its
  // own errors and returns false rather than throwing.
  let emailSent = false;
  if (validEmail) {
    const bizName = business?.name ?? 'Your appointment';

    const rows = [
      { label: 'Service', value: service?.name ?? 'Appointment' },
      { label: 'When', value: whenLabel },
    ];
    if (amountPaid) rows.push({ label: 'Paid', value: formatMoney(amountPaid) });

    // Return value used to matter to no one - the confirmation screen
    // told every customer "A confirmation has been sent to {email}"
    // unconditionally, whether or not sendEmail actually returned true.
    // sendEmail itself never throws (see lib/email.ts), so awaiting it
    // here can't turn a successful booking into a client-visible 500 -
    // this is only about telling the truth about the email specifically.
    emailSent = await sendEmail(
      {
        to: validEmail,
        subject: `Your ${bizName} appointment is confirmed`,
        html: renderEmail({
          businessName: bizName,
          accentColor: business?.accent_color,
          logoUrl: business?.logo_url,
          preheader: `${service?.name ?? 'Your appointment'} - ${whenLabel}`,
          heading: "You're booked",
          intro: `Hi ${validName}, your appointment is confirmed. Here are the details.`,
          rows,
          cta: business?.slug
            ? { label: 'Manage this booking', url: `${SITE_URL}/${business.slug}/manage/${booking.id}` }
            : null,
          footerNote: 'Need to reschedule or cancel? Use the link above.',
        }),
        fromName: bizName,
      },
      'api/bookings:confirmation-email',
      { businessId }
    );
  }

  return NextResponse.json({ booking, emailSent });
}
