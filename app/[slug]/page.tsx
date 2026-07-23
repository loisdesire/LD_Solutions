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

  const { business, services, hoursSummary } = data;

  // Service role: booking_rules is staff-only under RLS, but the date
  // picker below needs max_advance_days to cap what it lets a customer pick.
  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('max_advance_days')
    .eq('business_id', business.id)
    .maybeSingle();

  const maxAdvanceDays = rules?.max_advance_days ?? 30;

  const galleryImages = (business.gallery_urls ?? '')
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean);

  const hasContact = Boolean(
    business.contact_phone || business.contact_email || business.instagram_url || business.facebook_url
  );

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

      {/* Top nav — fixed, real per-business identity (logo/name), a real
          anchor to the booking section below (no dead links to pages that
          don't exist in this app) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-paper border-b border-line">
        <nav className="flex justify-between items-center w-full px-6 sm:px-10 py-4 max-w-5xl mx-auto">
          <a href="#book" className="flex items-center gap-2.5">
            {business.logo_url ? (
              <img src={business.logo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center font-display text-[13px] font-semibold shrink-0"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                {business.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="font-display text-[17px] font-semibold text-ink truncate">{business.name}</span>
          </a>
          <div className="flex items-center gap-6">
            <a href="#book" className="hidden sm:inline font-medium text-[13.5px] text-ink-soft hover:text-ink transition-colors">
              Services
            </a>
            {business.about_text && (
              <a href="#about" className="hidden sm:inline font-medium text-[13.5px] text-ink-soft hover:text-ink transition-colors">
                About
              </a>
            )}
            {galleryImages.length > 0 && (
              <a href="#gallery" className="hidden sm:inline font-medium text-[13.5px] text-ink-soft hover:text-ink transition-colors">
                Gallery
              </a>
            )}
            {hasContact && (
              <a href="#contact" className="hidden sm:inline font-medium text-[13.5px] text-ink-soft hover:text-ink transition-colors">
                Contact
              </a>
            )}
            <a href="/account" className="hidden sm:inline font-medium text-[13.5px] text-ink-soft hover:text-ink transition-colors">
              My bookings
            </a>
            <a
              href="#book"
              className="px-5 py-2.5 rounded-full font-medium text-[13.5px] text-white transition-opacity hover:opacity-90 active:scale-95"
              style={{ background: 'var(--accent)' }}
            >
              Book now
            </a>
          </div>
        </nav>
      </header>

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
          <div className="absolute inset-0 bg-black/35" />
        </div>

        <div className="relative z-10 w-full px-6 sm:px-10 max-w-5xl mx-auto text-white">
          <div className="max-w-2xl">
            {business.description && (
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-white/90 mb-4 max-w-[48ch]">
                {business.description}
              </p>
            )}
            <h1 className="font-display text-[36px] sm:text-[52px] font-semibold leading-[1.05]">
              Book your visit
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
          </div>
        </div>
      </section>

      <main id="book" className="relative max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-20 scroll-mt-20">
        <BookingForm
          businessId={business.id}
          slug={slug}
          services={services}
          maxAdvanceDays={maxAdvanceDays}
        />
      </main>

      {business.about_text && (
        <section id="about" className="border-t border-line scroll-mt-20">
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 text-center">
            <h2 className="font-display text-[28px] sm:text-[32px] font-semibold text-ink mb-5">About</h2>
            <p className="text-[15.5px] leading-relaxed text-ink-soft whitespace-pre-line">
              {business.about_text}
            </p>
          </div>
        </section>
      )}

      {galleryImages.length > 0 && (
        <section id="gallery" className="border-t border-line scroll-mt-20">
          <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16">
            <h2 className="font-display text-[28px] sm:text-[32px] font-semibold text-ink mb-8 text-center">
              Gallery
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {galleryImages.map((url, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-surface">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasContact && (
        <section id="contact" className="border-t border-line scroll-mt-20">
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 text-center">
            <h2 className="font-display text-[28px] sm:text-[32px] font-semibold text-ink mb-8">Contact</h2>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {business.contact_phone && (
                <a href={`tel:${business.contact_phone}`} className="text-[14.5px] text-ink-soft hover:text-ink transition-colors">
                  {business.contact_phone}
                </a>
              )}
              {business.contact_email && (
                <a href={`mailto:${business.contact_email}`} className="text-[14.5px] text-ink-soft hover:text-ink transition-colors">
                  {business.contact_email}
                </a>
              )}
              {business.instagram_url && (
                <a href={business.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[14.5px] text-ink-soft hover:text-ink transition-colors">
                  Instagram
                </a>
              )}
              {business.facebook_url && (
                <a href={business.facebook_url} target="_blank" rel="noopener noreferrer" className="text-[14.5px] text-ink-soft hover:text-ink transition-colors">
                  Facebook
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer — only real info: the business's own name, tagline, and
          hours again for anyone who scrolled straight past the hero */}
      <footer className="bg-[#ebe8e3] border-t border-line mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full px-6 sm:px-10 py-12 max-w-5xl mx-auto text-center sm:text-left">
          <div>
            <div className="flex items-center gap-2.5 mb-3 justify-center sm:justify-start">
              {business.logo_url ? (
                <img src={business.logo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center font-display text-[13px] font-semibold shrink-0"
                  style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
                >
                  {business.name?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="font-display text-[18px] font-semibold" style={{ color: 'var(--accent)' }}>
                {business.name}
              </span>
            </div>
            {business.description && (
              <p className="text-[13.5px] text-ink-soft max-w-sm mx-auto sm:mx-0">{business.description}</p>
            )}
          </div>
          <div className="flex flex-col items-center sm:items-end justify-center gap-2">
            {hoursSummary && <p className="text-[12.5px] text-ink-faint">{hoursSummary}</p>}
            <p className="text-[11.5px] text-ink-faint">
              © {new Date().getFullYear()} {business.name}
            </p>
          </div>
        </div>
      </footer>
    </AccentScope>
  );
}
