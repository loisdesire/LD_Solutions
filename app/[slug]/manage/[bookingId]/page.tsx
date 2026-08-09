import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import ManageBooking from '@/components/ManageBooking';
import TicketPerforation from '@/components/TicketPerforation';
import { AccentScope } from '@/components/AccentScope';
import type { Metadata } from 'next';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Reached only via an unguessable booking id — never meant to be indexed.
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

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, customer_name, start_time, status, business_id, service_id, services(name, duration_minutes), businesses(name, accent_color)'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) notFound();

  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('max_advance_days')
    .eq('business_id', booking.business_id)
    .maybeSingle();

  const maxAdvanceDays = rules?.max_advance_days ?? 30;

  const business = booking.businesses as any;
  const service = booking.services as any;
  const statusLabel: Record<string, string> = {
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
    no_show: 'No-show',
  };

  return (
    <AccentScope color={business?.accent_color ?? '#B5502F'} className="min-h-screen bg-paper">
      <main className="flex items-center justify-center px-6 py-16 min-h-screen">
        <div className="w-full max-w-md animate-rise">
          <div className="flex items-center justify-between mb-6">
            <a
              href={`/${slug}`}
              className="flex items-center gap-1 text-[13px] font-medium text-ink-faint hover:text-ink transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              {business?.name}
            </a>
            <a href="/account" className="text-[13px] font-medium text-ink-faint hover:text-ink transition-colors">
              My bookings
            </a>
          </div>
          <div className="text-center mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Manage your booking
            </div>
          </div>

          {/* Same ticket identity as the booking confirmation (BookingForm's
              confirmed step) — a customer's booking should look like the same
              object when they come back to it, not a different card. */}
          <div className="rounded-2xl border-2 border-line-strong bg-surface shadow-[0_24px_60px_-30px_rgba(28,23,18,0.4)] overflow-hidden">
            <div
              className="p-5 sm:p-6"
              style={{ backgroundImage: 'linear-gradient(150deg, var(--accent-soft), transparent 70%)' }}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em]"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel[booking.status] ?? booking.status}
              </span>
              <h1 className="font-display text-[24px] mt-3">{service?.name}</h1>
            </div>
            <div className="px-5 sm:px-6">
              <div className="flex justify-between py-2.5 text-[13.5px] border-b border-dashed border-line">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                  Date
                </span>
                <span className="font-semibold">
                  {new Date(booking.start_time).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
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
                  })}
                </span>
              </div>
              <div className="flex justify-between py-2.5 text-[13.5px]">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                  Booked for
                </span>
                <span className="font-semibold">{booking.customer_name}</span>
              </div>
            </div>

            <div className="px-5 sm:px-6 mt-2">
              <TicketPerforation notchColor="var(--paper)" />
            </div>

            <div className="px-5 sm:px-6 py-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                Booking code
              </span>
              <span className="font-mono text-[15px] tracking-[0.25em] font-semibold text-ink">
                {booking.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <ManageBooking
              bookingId={booking.id}
              businessId={booking.business_id}
              serviceId={booking.service_id}
              initialStatus={booking.status}
              startTime={booking.start_time}
              maxAdvanceDays={maxAdvanceDays}
            />
          </div>
        </div>
      </main>
    </AccentScope>
  );
}
