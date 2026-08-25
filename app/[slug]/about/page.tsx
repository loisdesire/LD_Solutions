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
  return { title: data ? `About - ${data.business.name}` : 'About' };
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
          {/* Reuses the same cover photo the hero already has (no new
              field/query) - this page was pure text with nothing to
              visually anchor it, noticeably barer than every other public
              page. */}
          {business.cover_image_url && (
            <img
              src={business.cover_image_url}
              alt=""
              className="w-full max-h-[280px] object-cover rounded-2xl mb-10"
            />
          )}
          <h1 className="font-display text-[32px] sm:text-[38px] font-semibold text-ink mb-6">About</h1>
          <p className="text-[15.5px] leading-relaxed text-ink-soft whitespace-pre-line text-left sm:text-center">
            {business.about_text}
          </p>

          {/* Hours were already fetched for this page (the footer uses
              them) but never actually shown here - someone reading about
              the business is a natural moment to also tell them when
              they're open, not just leave it to the booking form to
              reveal indirectly through which dates are available. */}
          {hoursSummary && (
            <div className="flex items-center justify-center gap-2.5 mt-8 text-ink-soft">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="text-[14px]">{hoursSummary}</span>
            </div>
          )}

          <div className="mt-10">
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
        </div>
      </main>
      <SiteFooter business={business} hoursSummary={hoursSummary} showContact={showContact} />
      <WebChatWidget businessId={business.id} businessName={business.name} />
    </AccentScope>
  );
}
