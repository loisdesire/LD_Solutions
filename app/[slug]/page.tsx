import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import BookingForm from '@/components/BookingForm';
import { AccentScope } from '@/components/AccentScope';
import { SITE_URL } from '@/lib/site';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);

  if (!data) return { title: 'Book an appointment' };

  const { business } = data;
  const title = `Book with ${business.name}`;
  const description = `Book an appointment with ${business.name} online — real-time availability, instant confirmation, no account needed.`;

  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${slug}`,
      type: 'website',
      images: business.logo_url ? [{ url: business.logo_url }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    url: `${SITE_URL}/${slug}`,
    ...(business.logo_url ? { image: business.logo_url } : {}),
    ...(services.length > 0
      ? {
          makesOffer: services.map((s) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: s.name },
            ...(s.price != null ? { price: s.price, priceCurrency: 'NGN' } : {}),
          })),
        }
      : {}),
  };

  return (
    <AccentScope color={business.accent_color} className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-line">
        <div className="max-w-[640px] mx-auto px-6 py-7 flex items-center gap-3">
          {business.logo_url ? (
            <img src={business.logo_url} alt="" className="h-11 w-11 rounded-full object-cover shrink-0" />
          ) : (
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center font-display text-[18px] shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              {business.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-display text-[19px] leading-none text-ink">{business.name}</div>
            <div className="font-mono text-[11px] text-ink-faint mt-1.5">Book an appointment</div>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-6 py-10 sm:py-14">
        <BookingForm
          businessId={business.id}
          slug={slug}
          services={services}
          maxAdvanceDays={maxAdvanceDays}
        />
      </main>
    </AccentScope>
  );
}
