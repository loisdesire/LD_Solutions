import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import ManageBooking from '@/components/ManageBooking';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      'id, customer_name, start_time, status, business_id, service_id, services(name, duration_minutes), businesses(name)'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) notFound();

  return (
    <main className="min-h-screen bg-canvas bg-grid">
      <div className="max-w-md mx-auto px-6 py-16 sm:py-24 animate-rise">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Your booking
          </h1>
          <p className="text-muted mt-3">{(booking.businesses as any)?.name}</p>
        </header>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft mb-4">
          <p className="font-semibold">{(booking.services as any)?.name}</p>
          <p className="text-muted text-sm mt-1">
            {new Date(booking.start_time).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
          <p className="text-muted text-sm mt-1">Booked for {booking.customer_name}</p>
        </div>

        <ManageBooking
          bookingId={booking.id}
          businessId={booking.business_id}
          serviceId={booking.service_id}
          initialStatus={booking.status}
        />
      </div>
    </main>
  );
}
