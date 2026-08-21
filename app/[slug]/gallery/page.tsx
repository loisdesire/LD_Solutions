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
        </div>
      </main>
      <SiteFooter business={business} hoursSummary={hoursSummary} showContact={showContact} />
      <WebChatWidget businessId={business.id} businessName={business.name} />
    </AccentScope>
  );
}
