import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import ManageBooking from '@/components/ManageBooking';
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
  const { bookingId } = await params;

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, customer_name, start_time, status, business_id, service_id, services(name, duration_minutes), businesses(name, accent_color)'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) notFound();

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
          <div className="text-center mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Manage your booking · {business?.name}
            </div>
          </div>

          <div className="border border-line rounded-md overflow-hidden">
            <div
              className="p-5 border-b border-dashed border-line-strong"
              style={{ backgroundImage: 'linear-gradient(150deg, var(--accent-soft), var(--paper) 70%)' }}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em]"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel[booking.status] ?? booking.status}
              </span>
              <h1 className="font-display text-[22px] mt-3">{service?.name}</h1>
              <div className="font-mono text-[12px] text-ink-soft mt-1">
                Booking #{booking.id.slice(0, 8).toUpperCase()}
              </div>
            </div>
            <div className="p-5">
              <div className="flex justify-between py-2 text-[13.5px] border-b border-dashed border-line">
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
              <div className="flex justify-between py-2 text-[13.5px] border-b border-dashed border-line">
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
              <div className="flex justify-between py-2 text-[13.5px]">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                  Booked for
                </span>
                <span className="font-semibold">{booking.customer_name}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <ManageBooking
              bookingId={booking.id}
              businessId={booking.business_id}
              serviceId={booking.service_id}
              initialStatus={booking.status}
            />
          </div>
        </div>
      </main>
    </AccentScope>
  );
}
