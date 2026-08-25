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
      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <h1 className="font-display text-[32px] sm:text-[38px] font-semibold text-ink mb-10 text-center">
            Gallery
          </h1>
          <GalleryGrid images={galleryImages} />

          {galleryImages.length > 0 && (
            <div className="mt-12 text-center">
              <a
                href={`/${slug}#book`}
                className="inline-flex items-center gap-1.5 px-6 py-3 min-h-[48px] rounded-full font-semibold text-[14px] text-white transition-opacity hover:opacity-90 active:scale-95"
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
