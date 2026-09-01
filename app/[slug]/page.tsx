import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSiteContentFlags } from '@/lib/siteContent';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Image from 'next/image';
import BookingForm from '@/components/BookingForm';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import WebChatWidget from '@/components/WebChatWidget';
import { AccentScope } from '@/components/AccentScope';
import { SITE_URL, DEMO_SLUG } from '@/lib/site';
import { canAcceptBookings } from '@/lib/subscription-server';
import { formatMoney } from '@/lib/formatMoney';
import { safeJsonLdString } from '@/lib/jsonLd';

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
  const description = business.description
    ? `${business.description} Book an appointment with ${business.name} online with real-time availability and instant confirmation.`
    : `Book an appointment with ${business.name} online - real-time availability, instant confirmation, no account needed.`;

  return {
    title,
    description,
    keywords: [
      `${business.name} booking`,
      `${business.name} appointments`,
      `book ${business.name}`,
      'online appointment booking',
    ],
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

  const { business, services, hoursSummary, isOpenNow } = data;

  // "From ₦X" rather than nothing - the hero previously gave no price
  // signal at all until you'd already picked a service in the booking
  // form below. Only services with a real price count; a null price
  // means "ask for pricing", not free.
  const pricedServices = services.map((s) => s.price).filter((p): p is number => p != null);
  const startingPrice = pricedServices.length > 0 ? Math.min(...pricedServices) : null;

  // Service role: booking_rules is staff-only under RLS, but the date
  // picker below needs max_advance_days to cap what it lets a customer pick,
  // and now also whether this business requires payment to confirm.
  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('max_advance_days, require_payment, deposit_percentage, cancellation_window_hours')
    .eq('business_id', business.id)
    .maybeSingle();

  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  // Payment only actually applies if the business also finished connecting
  // Paystack - a business that flips the toggle on but never pastes a
  // public key shouldn't silently break booking for every customer.
  const requirePayment = Boolean(rules?.require_payment && business.paystack_public_key);
  const { showAbout, showGallery, showContact } = getSiteContentFlags(business);
  const acceptingBookings = await canAcceptBookings(business.id);

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
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }}
      />

      <SiteHeader
        slug={slug}
        business={business}
        active="home"
        showAbout={showAbout}
        showGallery={showGallery}
        showContact={showContact}
      />

      {/* Full-bleed now - was boxed inside max-w-6xl with side padding and
          margin all round, so the photo itself never actually reached
          either edge of the screen (the thing "fill the screen" was
          actually asking for - the height already filled the viewport,
          the width didn't). No horizontal constraint here at all now;
          the text/button content below gets its own max-w-6xl centering
          instead, so it stays readable on a wide screen without the
          photo being boxed in to match it. */}
      <section className="relative">
        <div className="relative overflow-hidden bg-surface shadow-card">
          {/* min-h-[70vh], not the full calc(100dvh-64px) this briefly was -
              filling the entire screen below the nav made a real cover
              photo (not an abstract pattern - actual chairs/pillars/floor)
              stretch into a tall, repetitive, oddly-proportioned strip
              once seen live on a wide desktop screen. Still a big,
              confident hero (70% of the viewport), just not stretched
              past what the photo's own composition can carry. */}
          <div className="relative min-h-[70vh]">
            <div className="absolute inset-0 z-0">
              {business.cover_image_url ? (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(23,20,18,0.28) 0%, rgba(23,20,18,0.15) 36%, rgba(23,20,18,0.2) 100%)',
                    }}
                  />
                  <Image
                    src={business.cover_image_url}
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    className="scale-[1.01] object-cover opacity-85 contrast-[1.02] brightness-[0.92] grayscale-[0.08]"
                  />
                </>
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(18,18,18,0.88), rgba(102,76,61,0.74), rgba(18,18,18,0.82))',
                  }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(17,17,17,0.04) 0%, rgba(17,17,17,0.18) 42%, rgba(17,17,17,0.38) 100%)',
                }}
              />
            </div>

            <div className="relative z-10 flex min-h-[70vh] items-center p-4 sm:p-6 lg:p-8">
              <div className="w-full max-w-6xl mx-auto">
              {/* Centered now, not left/bottom-anchored - with the section
                  actually filling real vertical space (70vh) on a wide
                  screen, a left-anchored text block left most of the
                  frame reading as empty photo with content shoved in one
                  corner. Centering makes the size the hero now has feel
                  intentional instead of unused. */}
              <div className="max-w-2xl mx-auto text-center">
                {hoursSummary && (
                  <span
                    className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]"
                    style={
                      isOpenNow
                        ? { background: 'rgba(20,184,166,0.9)', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {isOpenNow ? 'Open now' : 'Closed now'}
                  </span>
                )}

                {slug === DEMO_SLUG && (
                  <span
                    className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/85 px-3 py-1.5 text-[11.5px] font-semibold tracking-[0.02em]"
                    style={{ color: 'var(--accent)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /></svg>
                    Demo business - try booking, nothing&apos;s real
                  </span>
                )}

                <div className="space-y-4">
                  <div className="min-w-0">
                    {/* Bigger and bolder - 36/54/58px read as modest
                        against a hero this large, once the section
                        actually had 70vh of real height to fill rather
                        than a tight 360/440px box. font-bold, not
                        semibold, to hold its own at this size. */}
                    <h1 className="font-display text-[46px] font-bold leading-[0.96] tracking-[-0.04em] text-white sm:text-[76px] lg:text-[92px]">
                      {business.name}
                    </h1>
                  </div>

                  {business.description && (
                    <p className="max-w-[54ch] mx-auto text-[17px] leading-relaxed text-white/90 sm:text-[19px]">
                      {business.description}
                    </p>
                  )}
                </div>

                <div className="mt-8 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                  <a
                    href="#book"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                    style={{ background: 'var(--accent-contrast)', color: 'var(--accent)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
                    </svg>
                    Book an appointment
                  </a>

                  <a
                    href="#chat"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/50 bg-white/10 px-6 py-3.5 text-[14px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/18 active:scale-[0.98]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 4h16v12H8l-4 4V4z" />
                    </svg>
                    Ask AI
                  </a>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main id="book" className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-mt-20">
        {acceptingBookings ? (
          <BookingForm
            businessId={business.id}
            slug={slug}
            businessName={business.name}
            services={services}
            maxAdvanceDays={maxAdvanceDays}
            requirePayment={requirePayment}
            depositPercentage={rules?.deposit_percentage ?? 100}
            paystackPublicKey={business.paystack_public_key}
            timezone={business.timezone || 'UTC'}
            cancellationWindowHours={rules?.cancellation_window_hours ?? 24}
          />
        ) : (
          <div className="max-w-lg mx-auto text-center rounded-3xl bg-warm-surface py-14 px-6 border border-line">
            <p className="font-display text-[20px] text-ink mb-2">Not currently taking bookings</p>
            <p className="text-ink-soft text-[14px]">
              {business.name} isn&apos;t accepting online bookings right now. Please check back later or
              contact them directly.
            </p>
          </div>
        )}
      </main>

      <SiteFooter business={business} hoursSummary={hoursSummary} showContact={showContact} />
      <WebChatWidget
        businessId={business.id}
        businessName={business.name}
        serviceNames={services.map((s: { name: string }) => s.name)}
      />
    </AccentScope>
  );
}
