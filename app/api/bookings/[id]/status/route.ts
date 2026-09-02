import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { notifyCustomer, getNotifyCreds } from '@/lib/notifyCustomer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Staff-driven status changes - confirming, completing, marking a no-show,
// or cancelling on the customer's behalf. Distinct from
// /api/bookings/[id]/cancel, which is the *customer's* self-serve
// cancellation (unauthenticated, gated by the cancellation window). Staff
// acting on their own business's bookings don't need a login-free "secret
// link" model (they already have a session) and aren't bound by the
// cancellation window - that restriction exists to stop a customer
// cancelling five minutes before their appointment, not to stop the
// business itself from doing so.
const ALLOWED_STATUSES = ['confirmed', 'completed', 'no_show', 'cancelled'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Generous limit, not the tight 10/60s the rare billing actions use -
  // this is a routine admin action (confirm/complete/cancel) that gets
  // clicked repeatedly in normal use, e.g. processing several bookings
  // in a row.
  if (!(await rateLimit(`bookings-status:${getClientIp(req)}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status as string | undefined;
  const slug = body?.slug as string | undefined;

  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  if (!status || !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id, name');
  if (auth.error) return auth.error;
  const { business } = auth;

  // Fetched before the update, not after - the customer needs their own
  // contact info and what's actually changing (old status vs new), none
  // of which the plain `id, status` select this used to do could answer.
  // Also lets a cancel-on-an-already-cancelled-booking be told apart from
  // a genuine new cancellation, so it isn't double-notified.
  const { data: before } = await supabaseAdmin
    .from('bookings')
    .select('id, status, customer_name, customer_email, customer_phone, customer_telegram_username, start_time, services(name)')
    .eq('id', id)
    .eq('business_id', business.id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Scoped to this business's own id, not just the booking id - without
  // this a staff member logged into one business could change the status
  // of any booking anywhere by guessing/enumerating ids.
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .eq('business_id', business.id)
    .select('id, status')
    .maybeSingle();

  if (error) {
    logError('api/bookings/status:update', error, { bookingId: id, businessId: business.id });
    return NextResponse.json({ error: "Couldn't update that booking. Please try again." }, { status: 400 });
  }
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Only a genuine new cancellation, not a status change that happened to
  // already be cancelled - this used to notify nobody at all, so a
  // customer whose appointment the business cancelled found out only by
  // showing up (or not being reminded, since the reminders cron only
  // targets `confirmed` bookings).
  if (status === 'cancelled' && before.status !== 'cancelled') {
    try {
      const service = (Array.isArray(before.services) ? before.services[0] : before.services) as { name: string } | null;
      const creds = await getNotifyCreds(business.id);
      const whenLabel = new Date(before.start_time).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
      const text = `Hi ${before.customer_name}, your ${service?.name ?? 'appointment'} at ${creds.name ?? business.name} on ${whenLabel} has been cancelled. Contact us if you have questions.`;
      await notifyCustomer(
        creds,
        before,
        text,
        `Your appointment at ${creds.name ?? business.name} was cancelled`,
        'api/bookings/status:notify-customer',
        { bookingId: id, businessId: business.id },
        [
          { label: 'Service', value: service?.name ?? 'Appointment' },
          { label: 'Was scheduled for', value: whenLabel },
        ]
      );
    } catch (err) {
      logError('api/bookings/status:notify-customer', err, { bookingId: id, businessId: business.id });
    }
  }

  return NextResponse.json({ booking });
}
