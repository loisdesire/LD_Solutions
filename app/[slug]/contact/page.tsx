import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSiteContentFlags } from '@/lib/siteContent';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { AccentScope } from '@/components/AccentScope';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  return { title: data ? `Contact — ${data.business.name}` : 'Contact' };
}

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();

  const { business, hoursSummary } = data;
  const { showAbout, showGallery, showContact } = getSiteContentFlags(business);
  if (!showContact) notFound();

  return (
    <AccentScope color={business.accent_color} className="min-h-screen bg-paper">
      <SiteHeader
        slug={slug}
        business={business}
        active="contact"
        showAbout={showAbout}
        showGallery={showGallery}
        showContact={showContact}
      />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-20 text-center">
          <h1 className="font-display text-[32px] sm:text-[38px] font-semibold text-ink mb-10">Contact</h1>
          <div className="flex flex-col items-center gap-4">
            {business.contact_phone && (
              <a href={`tel:${business.contact_phone}`} className="text-[16px] text-ink-soft hover:text-ink transition-colors">
                {business.contact_phone}
              </a>
            )}
            {business.contact_email && (
              <a href={`mailto:${business.contact_email}`} className="text-[16px] text-ink-soft hover:text-ink transition-colors">
                {business.contact_email}
              </a>
            )}
            {business.instagram_url && (
              <a href={business.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[16px] text-ink-soft hover:text-ink transition-colors">
                Instagram
              </a>
            )}
            {business.facebook_url && (
              <a href={business.facebook_url} target="_blank" rel="noopener noreferrer" className="text-[16px] text-ink-soft hover:text-ink transition-colors">
                Facebook
              </a>
            )}
          </div>
        </div>
      </main>
      <SiteFooter business={business} hoursSummary={hoursSummary} />
    </AccentScope>
  );
}
