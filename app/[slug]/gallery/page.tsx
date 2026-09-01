import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSiteContentFlags } from '@/lib/siteContent';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import WebChatWidget from '@/components/WebChatWidget';
import GalleryGrid from '@/components/GalleryGrid';
import { AccentScope } from '@/components/AccentScope';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  return { title: data ? `Gallery - ${data.business.name}` : 'Gallery' };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();

  const { business, hoursSummary } = data;
  const { galleryImages, showAbout, showGallery, showContact } = getSiteContentFlags(business);
  if (!showGallery) notFound();

  return (
    <AccentScope color={business.accent_color} className="min-h-screen bg-paper">
      <SiteHeader
        slug={slug}
        business={business}
        active="gallery"
        showAbout={showAbout}
        showGallery={showGallery}
        showContact={showContact}
      />
      {/* No pt-16 here - SiteHeader is `sticky`, not `fixed`, so it already
          reserves its own space in the layout. This was stacking with the
          inner div's own pt-16/pt-20 below, doubling to ~128-144px of dead
          space between the nav and the actual heading. */}
      <main>
        {/* pb-28 below: guards the trailing CTA the same way about/page.tsx
            guards its hours line - real, but a separate issue from the one
            below (that one's about content sitting AFTER this padding;
            this one's about a photo grid sitting BEFORE it, which trailing
            padding can't touch). */}
        <div className="max-w-5xl mx-auto px-6 sm:px-10 pt-16 sm:pt-20 pb-28 sm:pb-20">
          {/* mb-10 -> mb-1 on mobile only: unlike the hours-line fix in
              about/page.tsx (which worked by adding space BEFORE the
              colliding element), a photo grid can't be pushed clear of
              WebChatWidget's fixed button that way - with enough rows, some
              row always ends up spanning the button's fixed 768-824px band
              regardless of offset, since the grid just grows taller as
              photos are added. Shifting the whole grid UP instead (less
              space between the heading and the grid) is what actually
              clears it for a typical few-rows gallery: confirmed live
              (measured bounding boxes) that with 6 photos, this moves the
              last row's bottom edge above the button entirely rather than
              trying to push it below - not a mathematical guarantee for
              every possible photo count, but it closes the confirmed case
              and reduces how far into the page a
              gallery has to grow before the risk reappears. */}
          <h1 className="font-display text-[32px] sm:text-[38px] font-semibold text-ink mb-1 sm:mb-10 text-center">
            Gallery
          </h1>
          <GalleryGrid images={galleryImages} />

          {galleryImages.length > 0 && (
            <div className="mt-12 text-center">
              <a
                href={`/${slug}#book`}
                className="inline-flex items-center gap-1.5 px-6 py-3 min-h-[48px] rounded-full font-semibold text-[14px] text-accent-contrast transition-opacity hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent)' }}
              >
                Book an appointment
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </main>
      <SiteFooter business={business} hoursSummary={hoursSummary} showContact={showContact} />
      <WebChatWidget businessId={business.id} businessName={business.name} />
    </AccentScope>
  );
}
