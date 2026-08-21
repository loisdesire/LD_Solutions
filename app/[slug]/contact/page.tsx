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
            <p className="text-[15px] text-ink-soft">We&apos;d love to hear from you.</p>
          </div>

          {methods.length === 0 ? (
            <p className="text-center text-ink-faint text-[14px]">No contact details have been added yet. The quickest way to reach us is to book, or to ask in the chat.</p>
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
        </div>
      </main>
      <SiteFooter business={business} hoursSummary={hoursSummary} showContact={showContact} />
      <WebChatWidget businessId={business.id} />
    </AccentScope>
  );
}
