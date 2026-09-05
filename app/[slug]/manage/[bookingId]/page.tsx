import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ManageBooking from '@/components/ManageBooking';
import { AccentScope } from '@/components/AccentScope';
import { formatMoney } from '@/lib/formatMoney';
import { STATUS_LABELS } from '@/lib/bookingStatus';
import { logError } from '@/lib/logger';
import type { Metadata } from 'next';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Reached only via an unguessable booking id - never meant to be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Service role here too: bookings aren't publicly readable (customer PII),
// but this page is only ever reached via the unguessable booking id in the
// confirmation link, same trust model as the cancel API route.
export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;

  // services!bookings_service_business_fk, not bare services() - a second
  // FK on (service_id, business_id) means an unqualified embed is
  // ambiguous (PGRST201). Confirmed live: this was the actual cause of
  // "We couldn't load this booking" - a real Vercel log showed exactly
  // this code on a genuine booking, on both this query and its 42703
  // fallback below.
  const BOOKING_COLUMNS =
    'id, customer_name, start_time, status, business_id, service_id, payment_status, amount_paid, services!bookings_service_business_fk(name, duration_minutes, price), businesses(name, slug, accent_color, timezone)';

  let { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('id', bookingId)
    .maybeSingle();

  // 42703 = the payments migration hasn't run on this database yet - same
  // reasoning as everywhere else this pattern appears: the combined select
  // fails as one unit, so fall back to the pre-payments column set rather
  // than take this page down for every booking, paid or not.
  if (bookingError?.code === '42703') {
    const fallback = await supabaseAdmin
      .from('bookings')
      .select('id, customer_name, start_time, status, business_id, service_id, services!bookings_service_business_fk(name, duration_minutes, price), businesses(name, slug, accent_color, timezone)')
      .eq('id', bookingId)
      .maybeSingle();
    booking = fallback.data ? { ...fallback.data, payment_status: null, amount_paid: null } : null;
    bookingError = fallback.error;
  }

  // This used to only ever check for the one 42703 case above, then fall
  // straight to notFound() for literally any other outcome - including a
  // genuine query error (a different missing column, a transient DB
  // issue, anything). That meant a real booking, on a real error, showed
  // a 404 - indistinguishable from "this booking doesn't exist" to the
  // customer AND to us, since nothing was ever logged either. Confirmed
  // live: a customer with a real booking got exactly this 404 from their
  // confirmation email. Now: an actual error is logged and shown as an
  // error, not silently treated as "not found" - notFound() is reserved
  // for the one case that's actually true, no row and no error.
  if (bookingError) {
    logError('manage-booking:load', bookingError, { slug, bookingId });
    return (
      <main className="flex items-center justify-center px-6 py-16 min-h-screen bg-paper">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-[20px] text-ink mb-2">We couldn&rsquo;t load this booking</p>
          <p className="text-ink-soft text-[14px]">
            This is us, not you - please try again in a moment, or contact the business directly using your booking
            confirmation.
          </p>
        </div>
      </main>
    );
  }

  if (!booking) notFound();

  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('max_advance_days, cancellation_window_hours')
    .eq('business_id', booking.business_id)
    .maybeSingle();

  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  const cancellationWindowHours = rules?.cancellation_window_hours ?? 24;

  const business = booking.businesses as any;
  const service = booking.services as any;

  return (
    <AccentScope color={business?.accent_color ?? '#B5502F'} className="min-h-screen bg-paper">
      <main className="flex items-center justify-center px-6 py-16 min-h-screen">
        <div className="w-full max-w-md animate-rise">
          <div className="flex items-center justify-between mb-6">
            <Link
              href={`/${slug}`}
              className="flex items-center gap-1 text-[13px] font-medium text-ink-faint hover:text-ink transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              {business?.name}
            </Link>
            <Link href="/account" className="text-[13px] font-medium text-ink-faint hover:text-ink transition-colors">
              My bookings
            </Link>
          </div>
          <div className="text-center mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Manage your booking
            </div>
          </div>

          {/* Same card identity as the booking confirmation (BookingForm's
              confirmed step) - a customer's booking should look like the same
              object when they come back to it, not a different card. */}
          <div className="rounded-3xl bg-surface border-2 border-line shadow-[0_20px_50px_-20px_var(--accent-soft)] overflow-hidden">
            <div
              className="p-5 sm:p-6"
              style={{ backgroundImage: 'linear-gradient(150deg, var(--accent-soft), transparent 70%)' }}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em]"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {STATUS_LABELS[booking.status] ?? booking.status}
              </span>
              <h1 className="font-display text-[24px] font-bold mt-3">{service?.name}</h1>
            </div>
            <div className="px-5 sm:px-6">
              <div className="flex justify-between py-2.5 text-[13.5px] border-b border-dashed border-line">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                  Date
                </span>
                <span className="font-semibold">
                  {/* timeZone explicitly set to the business's own - was
                      missing entirely (toLocaleDateString with no
                      timeZone uses the VIEWER's device zone), so a
                      customer or business outside that zone saw a time
                      genuinely offset from the real appointment. Same
                      fix as BookingForm's confirmation step. */}
                  {new Date(booking.start_time).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    timeZone: business?.timezone,
                  })}
                </span>
              </div>
              <div className="flex justify-between py-2.5 text-[13.5px] border-b border-dashed border-line">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                  Time
                </span>
                <span className="font-semibold">
                  {new Date(booking.start_time).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: business?.timezone,
                  })}
                </span>
              </div>
              <div className={`flex justify-between py-2.5 text-[13.5px] ${service?.price != null || booking.payment_status ? 'border-b border-dashed border-line' : ''}`}>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                  Booked for
                </span>
                <span className="font-semibold">{booking.customer_name}</span>
              </div>
              {/* Price and payment state - previously absent entirely, so
                  a customer checking on a paid booking had no way to
                  confirm their payment actually went through from this
                  page. */}
              {(service?.price != null || booking.payment_status) && (
                <div className="flex justify-between py-2.5 text-[13.5px]">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                    {booking.payment_status === 'paid' ? 'Paid' : 'Price'}
                  </span>
                  <span className="font-semibold">
                    {booking.payment_status === 'paid' && booking.amount_paid != null
                      ? formatMoney(Number(booking.amount_paid))
                      : service?.price != null
                        ? formatMoney(service.price)
                        : '-'}
                    {booking.payment_status === 'pending' && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.05em]" style={{ color: 'var(--warning)' }}>
                        Awaiting payment
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="mx-5 sm:mx-6 border-t-2 border-dashed border-line" />
            <div className="px-5 sm:px-6 py-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                Booking code
              </span>
              <span className="font-mono text-[15px] tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>
                {booking.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          {booking.status !== 'cancelled' && new Date(booking.start_time).getTime() > Date.now() && (
            <p className="text-ink-faint text-[12px] text-center mt-4">
              Free to cancel or reschedule up to {cancellationWindowHours} hour
              {cancellationWindowHours === 1 ? '' : 's'} before your appointment.
            </p>
          )}

          <div className="mt-4">
            <ManageBooking
              slug={slug}
              bookingId={booking.id}
              businessId={booking.business_id}
              serviceId={booking.service_id}
              initialStatus={booking.status}
              startTime={booking.start_time}
              maxAdvanceDays={maxAdvanceDays}
              timeZone={business?.timezone}
            />
          </div>
        </div>
      </main>
    </AccentScope>
  );
}
