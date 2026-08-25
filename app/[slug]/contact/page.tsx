import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSiteContentFlags } from '@/lib/siteContent';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import WebChatWidget from '@/components/WebChatWidget';
import { AccentScope } from '@/components/AccentScope';
import EmptyState from '@/components/EmptyState';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  return { title: data ? `Contact ${data.business.name}` : 'Contact' };
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();

  const { business, hoursSummary } = data;
  const { showAbout, showGallery, showContact } = getSiteContentFlags(business);
  if (!showContact) notFound();

  const methods = [
    business.contact_phone && {
      key: 'phone',
      label: 'Call',
      value: business.contact_phone,
      href: `tel:${business.contact_phone}`,
      external: false,
      icon: (
        <svg {...iconProps}>
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2C9.5 21 3 14.5 3 6a2 2 0 012-2z" />
        </svg>
      ),
    },
    business.contact_email && {
      key: 'email',
      label: 'Email',
      value: business.contact_email,
      href: `mailto:${business.contact_email}`,
      external: false,
      icon: (
        <svg {...iconProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      ),
    },
    business.instagram_url && {
      key: 'instagram',
      label: 'Instagram',
      value: 'Follow us',
      href: business.instagram_url,
      external: true,
      icon: (
        <svg {...iconProps}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    business.facebook_url && {
      key: 'facebook',
      label: 'Facebook',
      value: 'Follow us',
      href: business.facebook_url,
      external: true,
      icon: (
        <svg {...iconProps}>
          <path d="M15 4h-2a4 4 0 00-4 4v3H7v4h2v6h4v-6h3l1-4h-4V8a1 1 0 011-1h3V4z" />
        </svg>
      ),
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    value: string;
    href: string;
    external: boolean;
    icon: React.ReactNode;
  }[];

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
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h1 className="font-display text-[32px] sm:text-[38px] font-semibold text-ink mb-3">Get in touch</h1>
            {/* Actual hours, not filler - "We'd love to hear from you"
                said nothing a visitor could act on. hoursSummary was
                already fetched for the footer on this exact page. */}
            {hoursSummary ? (
              <p className="text-[15px] text-ink-soft">{hoursSummary}</p>
            ) : (
              <p className="text-[15px] text-ink-soft">We&apos;d love to hear from you.</p>
            )}
          </div>

          {methods.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                  <path d="M4 4h16v12H8l-4 4V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              }
              title="No contact details listed yet"
              description="The quickest way to reach us is to book directly, or ask a question in chat."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <a
                    href={`/${slug}#book`}
                    className="rounded-full px-5 py-2.5 min-h-[44px] flex items-center text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--accent)' }}
                  >
                    Book an appointment
                  </a>
                  <a
                    href="#chat"
                    className="rounded-full border-2 border-line-strong px-5 py-2.5 min-h-[44px] flex items-center text-body-sm font-semibold text-ink hover:border-accent hover:text-accent transition-colors"
                  >
                    Chat with us
                  </a>
                </div>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
              {methods.map((m) => (
                <a
                  key={m.key}
                  href={m.href}
                  target={m.external ? '_blank' : undefined}
                  rel={m.external ? 'noopener noreferrer' : undefined}
                  className="group flex items-center gap-4 rounded-2xl bg-surface border-2 border-line p-5 transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_16px_-10px_var(--accent-soft)] hover:shadow-[0_16px_32px_-12px_var(--accent-soft)] hover:border-[var(--accent)]"
                >
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {m.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
                      {m.label}
                    </div>
                    <div className="text-[14.5px] font-semibold text-ink truncate mt-0.5">{m.value}</div>
                  </div>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-ink-faint group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all shrink-0"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </a>
              ))}
            </div>
          )}

          {methods.length > 0 && (
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
