import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSiteContentFlags } from '@/lib/siteContent';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import BookingForm from '@/components/BookingForm';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import WebChatWidget from '@/components/WebChatWidget';
import ChatHero from '@/components/ChatHero';
import InfoPanel from '@/components/InfoPanel';
import { AccentScope } from '@/components/AccentScope';
import { SITE_URL, DEMO_SLUG } from '@/lib/site';
import { canAcceptBookings } from '@/lib/subscription-server';
import { formatMoney } from '@/lib/formatMoney';
import { safeJsonLdString } from '@/lib/jsonLd';
import { logError } from '@/lib/logger';

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

  // Top 3 services by real booking volume, for the chat-first hero's
  // info panel - a brand-new business with no booking history yet
  // falls back to the first 3 configured services rather than an empty
  // card (see InfoPanel's own comment). Plain service_id counts, not an
  // embedded services(...) join - avoids the exact PGRST201 ambiguity
  // that broke every other bookings->services embed in this codebase
  // (two valid FKs on the pair now that bookings_service_business_fk
  // exists) by never embedding at all; counts are just mapped onto the
  // services array already loaded above.
  const { data: bookingCounts, error: bookingCountsError } = await supabaseAdmin
    .from('bookings')
    .select('service_id')
    .eq('business_id', business.id)
    .neq('status', 'cancelled');
  if (bookingCountsError) {
    logError('business-page:popular-services', bookingCountsError, { businessId: business.id });
  }
  const countsByService = new Map<string, number>();
  for (const row of bookingCounts ?? []) {
    if (!row.service_id) continue;
    countsByService.set(row.service_id, (countsByService.get(row.service_id) ?? 0) + 1);
  }
  const popularServices =
    countsByService.size > 0
      ? [...services].sort((a, b) => (countsByService.get(b.id) ?? 0) - (countsByService.get(a.id) ?? 0)).slice(0, 3)
      : services.slice(0, 3);

  // Real, business-specific openers - the exact same pattern
  // WebChatWidget's own floating panel already uses, so the chips here
  // and that widget's suggested questions never quietly diverge from
  // each other.
  const suggestedPrompts = [
    'What times are free tomorrow?',
    services[0] ? `How much is ${services[0].name}?` : 'What do you charge?',
    'Are you open at the weekend?',
  ];

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

      {/* Its own strip now, not sharing the hero's badge row with the
          open/closed status - the two were competing for the same small
          slot at the top of the centered content, and status (can I book
          right now) is the one that actually matters to every visitor,
          demo or not. A plain, persistent strip reads as "site-wide
          notice" too, which is closer to what this actually is. */}
      {slug === DEMO_SLUG && (
        <div className="text-center py-2 px-4" style={{ background: 'var(--accent-soft)' }}>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /></svg>
            Demo business - try booking, nothing&apos;s real
          </span>
        </div>
      )}

      {/* Chat-first hero - was a full-bleed cover photo behind a
          centered "Book an appointment" / "Ask AI" button pair, leading
          into a 3-step manual form; the AI chat only existed as a
          secondary link. That directly contradicted the site's own
          "AI receptionist that actually books" claim: a visitor who
          clicked through landed on a page that led with a form. Nothing
          below is removed - the manual flow (BookingForm at #book) is
          completely unchanged, just no longer the first thing on the
          page; cover_image_url is still used elsewhere (the About
          page), just not leading this one anymore. Grid, not floated/
          absolutely-positioned pieces, so the two columns can stack on
          mobile without restructuring anything. */}
      <section className="bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-4">
          <div className="max-w-2xl mx-auto text-center mb-8 sm:mb-10">
            <h1 className="font-display text-[32px] sm:text-[42px] font-bold leading-[1.02] tracking-[-0.03em] text-ink mb-2.5">
              {business.name}
            </h1>
            {business.description && (
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-ink-soft">{business.description}</p>
            )}
          </div>

          {/* 1.5fr/1fr on lg+ (chat visibly primary, info secondary but
              not cramped); stacked below that rather than squeezing a
              two-column layout into a width where the chat card would
              drop under ~340px wide. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
            <ChatHero
              businessId={business.id}
              businessName={business.name}
              suggestedPrompts={suggestedPrompts}
              onBookingLinkFallback="#book"
            />
            <InfoPanel
              hoursSummary={hoursSummary}
              isOpenNow={isOpenNow}
              location={null}
              popularServices={popularServices}
              manualFlowHref="#book"
            />
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
