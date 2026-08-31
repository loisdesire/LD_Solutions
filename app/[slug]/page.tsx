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

      {/* Hero - the business's own cover photo if they've set one, or a
          rich accent-colored gradient in its place. Never a stock photo:
          nothing here is real unless the business actually provided it.

          min-h, not h - a business with a description, a long name that
          wraps to two lines, and an hours line together can exceed 420px
          on a phone. A fixed height plus overflow-hidden below used to
          silently clip whatever didn't fit; min-height lets the section
          grow to whatever the content actually needs instead. */}
      <section className="relative min-h-[420px] sm:min-h-[480px] pt-10 sm:pt-16 pb-8 sm:pb-0 flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          {business.cover_image_url ? (
            // alt="" is correct, not an oversight - decorative background
            // photo, and the one piece of information it could carry
            // (whose page this is) is already real text two lines down
            // (the "Book with {business.name}" h1). next/image + priority
            // because this is very likely the page's LCP element: full-
            // bleed, above the fold, on the one page type (the public
            // booking page) that gets real outside traffic.
            <Image
              src={business.cover_image_url}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
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
              against a bright uploaded photo - well under the 4.5:1 body
              text needs. 45% gets large text (the headline) to a safe
              ~3.4:1 on its own; the text-shadow below is the real
              backstop for everything else, since it holds legibility
              near the glyph edge regardless of how bright the photo
              actually is, without having to guess its composition. */}
          <div className="absolute inset-0 bg-black/45" />
        </div>

        <div className="relative z-10 w-full px-4 sm:px-10 max-w-5xl mx-auto text-white">
          <div className="max-w-2xl" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>
            {/* The marketing site's own "see it live" link already says
                "demo" in its own text, but that disclosure lived only on
                the page you left - nothing on this page itself told a
                visitor who landed here directly that it wasn't a real,
                oddly-named business. */}
            {slug === DEMO_SLUG && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold mb-4"
                style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--accent)', textShadow: 'none' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /></svg>
                Demo business - try booking, nothing&apos;s real
              </span>
            )}
            {business.description && (
              // line-clamp on mobile only - on a short phone viewport a
              // long description was pushing the name, hours, and both
              // CTAs further down the stack than a first glance should
              // need to scan. The full description still shows at sm+.
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-white/90 mb-4 max-w-[48ch] line-clamp-2 sm:line-clamp-none">
                {business.description}
              </p>
            )}
            {/* Personalized rather than a static "Book your visit" on
                every business's page - the first thing a visitor should
                know is whose page this actually is. */}
            <h1 className="font-display text-[32px] sm:text-[52px] font-semibold leading-[1.05]">
              Book with {business.name}
            </h1>
            {hoursSummary && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-5 sm:mt-6 text-white/90">
                <div className="flex items-center gap-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span className="text-[14px]">{hoursSummary}</span>
                </div>
                {/* Computed from today's actual hours in the business's own
                    timezone, not just the static weekly summary - a
                    visitor landing outside hours could see "Mon-Fri ·
                    9 AM-6 PM" and still not know at a glance whether now
                    counts. */}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                  style={
                    isOpenNow
                      ? { background: 'rgba(255,255,255,0.9)', color: 'var(--accent)' }
                      : { background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.5)' }
                  }
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isOpenNow ? 'bg-current' : 'bg-white/70'}`} />
                  {isOpenNow ? 'Open now' : 'Closed now'}
                </span>
              </div>
            )}

            {/* The deterministic form is the primary conversion path. Chat
                remains easy to discover for customers who prefer it, but
                no longer competes at equal visual weight with two other
                booking entry points (the form CTA and floating widget). */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 sm:mt-8">
              <a
                href="#book"
                className="w-full sm:w-auto px-6 py-3 min-h-[48px] flex items-center justify-center rounded-full font-semibold text-[14px] transition-opacity hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent-contrast)', color: 'var(--accent)', textShadow: 'none' }}
              >
                Book an appointment
              </a>
              <a
                href="#chat"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-full font-medium text-[14px] transition-colors hover:bg-white/10 active:scale-95"
                style={{ color: '#fff', textShadow: 'none' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4h16v12H8l-4 4V4z" />
                  <path d="M8 9h8M8 12h5" />
                </svg>
                Prefer to chat? Ask our AI
              </a>
            </div>

            {/* Price and payment expectations before commitment, not just
                after picking a service three steps into the form below -
                the two questions a first-time visitor actually has before
                they'll click "Book". */}
            {(startingPrice != null || requirePayment) && (
              <p className="text-[14px] text-white/85 mt-4">
                {startingPrice != null && <>From {formatMoney(startingPrice)}</>}
                {startingPrice != null && requirePayment && ' · '}
                {requirePayment && (
                  <>
                    {rules?.deposit_percentage != null && rules.deposit_percentage < 100
                      ? `${rules.deposit_percentage}% deposit`
                      : 'Payment'}{' '}
                    required to confirm
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      <main id="book" className="relative max-w-5xl mx-auto px-4 sm:px-10 py-12 sm:py-20 scroll-mt-20">
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
      <WebChatWidget
        businessId={business.id}
        businessName={business.name}
        serviceNames={services.map((s: { name: string }) => s.name)}
      />
    </AccentScope>
  );
}
