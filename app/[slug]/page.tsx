import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import BookingForm from '@/components/BookingForm';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function BusinessBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);

  if (!data) notFound();

  const { business, services } = data;

  // Service role: booking_rules is staff-only under RLS, but the date
  // picker below needs max_advance_days to cap what it lets a customer pick.
  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('max_advance_days')
    .eq('business_id', business.id)
    .maybeSingle();

  const maxAdvanceDays = rules?.max_advance_days ?? 30;

  return (
    <main
      style={{ '--accent': business.accent_color } as React.CSSProperties}
      className="min-h-screen bg-canvas bg-grid relative overflow-hidden"
    >
      <div
        className="pointer-events-none absolute -top-40 -right-24 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-md mx-auto px-6 py-16 sm:py-24 animate-rise">
        <header className="mb-10">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt=""
              className="h-11 w-11 rounded-xl mb-5 shadow-sm"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-brand mb-5 shadow-glow flex items-center justify-center text-white font-bold text-lg">
              {business.name?.[0]?.toUpperCase()}
            </div>
          )}
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            {business.name}
          </h1>
          <p className="text-muted mt-3">
            Choose a service and a time that works for you.
          </p>
        </header>

        <BookingForm
          businessId={business.id}
          slug={slug}
          services={services}
          maxAdvanceDays={maxAdvanceDays}
        />
      </div>
    </main>
  );
}
