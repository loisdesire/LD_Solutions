import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSiteContentFlags } from '@/lib/siteContent';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import WebChatWidget from '@/components/WebChatWidget';
import { AccentScope } from '@/components/AccentScope';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  return { title: data ? `About — ${data.business.name}` : 'About' };
}

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();

  const { business, hoursSummary } = data;
  const { showAbout, showGallery, showContact } = getSiteContentFlags(business);
  if (!showAbout) notFound();

  return (
    <AccentScope color={business.accent_color} className="min-h-screen bg-paper">
      <SiteHeader
        slug={slug}
        business={business}
        active="about"
        showAbout={showAbout}
        showGallery={showGallery}
        showContact={showContact}
      />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-20 text-center">
          <h1 className="font-display text-[32px] sm:text-[38px] font-semibold text-ink mb-6">About</h1>
          <p className="text-[15.5px] leading-relaxed text-ink-soft whitespace-pre-line text-left sm:text-center">
            {business.about_text}
          </p>
        </div>
      </main>
      <SiteFooter business={business} hoursSummary={hoursSummary} />
      <WebChatWidget businessId={business.id} />
    </AccentScope>
  );
}
