import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSiteContentFlags } from '@/lib/siteContent';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import BookingForm from '@/components/BookingForm';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import WebChatWidget from '@/components/WebChatWidget';
import { AccentScope } from '@/components/AccentScope';
import { SITE_URL } from '@/lib/site';
import { canAcceptBookings } from '@/lib/subscription-server';

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
    : `Book an appointment with ${business.name} online — real-time availability, instant confirmation, no account needed.`;

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

  const { business, services, hoursSummary } = data;

  // Service role: booking_rules is staff-only under RLS, but the date
  // picker below needs max_advance_days to cap what it lets a customer pick,
  // and now also whether this business requires payment to confirm.
  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('max_advance_days, require_payment, deposit_percentage')
    .eq('business_id', business.id)
    .maybeSingle();

  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  // Payment only actually applies if the business also finished connecting
  // Paystack — a business that flips the toggle on but never pastes a
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader
        slug={slug}
        business={business}
        active="home"
        showAbout={showAbout}
        showGallery={showGallery}
        showContact={showContact}
      />

      {/* Hero — the business's own cover photo if they've set one, or a
          rich accent-colored gradient in its place. Never a stock photo:
          nothing here is real unless the business actually provided it. */}
      <section className="relative h-[420px] sm:h-[480px] pt-16 flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          {business.cover_image_url ? (
            <img src={business.cover_image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background:
                  'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, black))',
              }}
            />
          )}
          {/* A flat 35% overlay only gets white text to ~2.5:1 contrast
              against a bright uploaded photo — well under the 4.5:1 body
              text needs. 45% gets large text (the headline) to a safe
              ~3.4:1 on its own; the text-shadow below is the real
              backstop for everything else, since it holds legibility
              near the glyph edge regardless of how bright the photo
              actually is, without having to guess its composition. */}
          <div className="absolute inset-0 bg-black/45" />
        </div>

        <div className="relative z-10 w-full px-6 sm:px-10 max-w-5xl mx-auto text-white">
          <div className="max-w-2xl" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>
            {business.description && (
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-white/90 mb-4 max-w-[48ch]">
                {business.description}
              </p>
            )}
            {/* Personalized rather than a static "Book your visit" on
                every business's page — the first thing a visitor should
                know is whose page this actually is. */}
            <h1 className="font-display text-[36px] sm:text-[52px] font-semibold leading-[1.05]">
              Book with {business.name}
            </h1>
            {hoursSummary && (
              <div className="flex items-center gap-2.5 mt-6 text-white/90">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span className="text-[14px]">{hoursSummary}</span>
              </div>
            )}

            {/* Chatting with the AI agent is a first-class way to book,
                not a minor extra — it gets equal billing with "Book now"
                here in the hero, not just a small corner bubble someone
                has to notice on their own. */}
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <a
                href="#book"
                className="px-6 py-3 rounded-full font-semibold text-[14px] transition-opacity hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent-contrast)', color: 'var(--accent)', textShadow: 'none' }}
              >
                Book now
              </a>
              <a
                href="#chat"
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] text-white border-2 border-white/70 transition-colors hover:bg-white/10 active:scale-95"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v12H8l-4 4V4z" />
                  <path d="M8 9h8M8 12h5" />
                </svg>
                Chat with us
              </a>
            </div>
          </div>
        </div>
      </section>

      <main id="book" className="relative max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-20 scroll-mt-20">
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
          />
        ) : (
          <div className="max-w-lg mx-auto text-center rounded-3xl bg-warm-surface py-14 px-6">
            <p className="font-display text-[20px] text-ink mb-2">Not currently taking bookings</p>
            <p className="text-ink-soft text-[14px]">
              {business.name} isn&apos;t accepting online bookings right now. Please check back later or
              contact them directly.
            </p>
          </div>
        )}
      </main>

      <SiteFooter business={business} hoursSummary={hoursSummary} showContact={showContact} />
      <WebChatWidget businessId={business.id} />
    </AccentScope>
  );
}
