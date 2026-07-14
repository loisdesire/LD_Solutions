import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/Reveal';
import HeroTabs from '@/components/HeroTabs';
import { SITE_URL } from '@/lib/site';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getAvailableSlots } from '@/lib/getAvailableSlots';

const DEMO_SLUG = 'glow-salon';

// Pulls real data from the actual demo business so this section shows what
// the platform genuinely does, not a made-up mockup. Searches forward a
// week for the first day with real open slots, so this never goes stale.
async function getDemoPreview() {
  const data = await getBusinessBySlug(DEMO_SLUG);
  if (!data || data.services.length === 0) return null;

  const service = data.services[0];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateISO = d.toISOString().split('T')[0];
    const slots = await getAvailableSlots(data.business.id, service.id, dateISO);
    if (slots.length > 0) {
      return { business: data.business, service, date: d, slots: slots.slice(0, 6) };
    }
  }
  return null;
}

export const metadata: Metadata = {
  title: 'Booking pages for small businesses',
  description:
    'A booking page that feels like you. Real-time availability, your own branded URL, and no app downloads for your customers. Set up in under two minutes.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Booking pages for small businesses',
    description:
      'A booking page that feels like you. Real-time availability, your own branded URL, and no app downloads for your customers.',
    url: SITE_URL,
    type: 'website',
  },
};

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
    title: 'Smart scheduling',
    description:
      'Real-time availability that respects your hours, buffer times, and existing bookings. No double-bookings, ever.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
    title: 'Your brand, your page',
    description:
      'Your own accent color, business name, and URL. Every booking page feels like it belongs to that business, not a template.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
        <circle cx="9" cy="11" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M17 3.13A4 4 0 0117 11" />
      </svg>
    ),
    title: 'Team management',
    description: 'Invite staff by email, manage roles, and let your whole team handle bookings from one place.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    title: 'Flexible hours',
    description: 'Set different hours for each day of the week. Close whenever you need to. Adjust in seconds.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: 'Self-serve for customers',
    description: 'Customers can view, reschedule, or cancel their own bookings from a private link. No phone tag.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    ),
    title: 'Webhooks & integrations',
    description: 'Connect every new booking to Zapier, Make, or your own CRM with a single webhook URL.',
  },
];

const businessTypes = [
  'Hair salons & barbershops',
  'Therapy & wellness clinics',
  'Private tutors & coaches',
  'Consultants & advisors',
  'Photographers & studios',
  'Personal trainers',
  'Massage therapists',
  'Music teachers',
];

export default async function LandingPage() {
  const preview = await getDemoPreview();

  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <nav className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">LD</span>
            </div>
            <span className="text-[14px] font-semibold text-ink tracking-tight">LD Solutions</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="/glow-salon"
              className="text-[13.5px] text-ink-soft hover:text-ink transition-colors hidden sm:inline"
            >
              Demo
            </a>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-md text-[13.5px] font-semibold text-white bg-accent hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pt-20 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-16 items-center">
          <Reveal>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-px w-8 bg-line-strong" />
              <span className="font-mono text-[11px] text-ink-faint uppercase tracking-[0.14em]">
                Appointment booking for small business
              </span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl text-ink leading-[1.15] mb-6">
              A booking page that feels <span className="italic">like you.</span>
            </h1>

            <p className="text-lg text-ink-soft leading-relaxed mb-8 max-w-lg">
              Give customers a booking page that feels considered, with real-time
              availability and zero back and forth. Booking takes seconds, not phone tag.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-[14px] font-semibold text-white bg-accent hover:opacity-90 transition-opacity"
              >
                Create your booking page
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href={`/${DEMO_SLUG}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-[14px] font-medium text-ink border border-line-strong hover:border-accent hover:text-accent transition-colors"
              >
                See it in action
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </a>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <HeroTabs />
          </Reveal>
        </div>
      </section>

      {/* Product preview */}
      <section className="border-y border-line bg-surface/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {preview && (
              <Reveal>
                <a
                  href={`/${DEMO_SLUG}`}
                  className="block bg-surface border border-line rounded-md overflow-hidden shadow-soft hover:border-line-strong transition-colors"
                >
                  <div className="px-5 py-4 border-b border-line flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-white font-display text-[13px]">
                      {preview.business.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{preview.business.name}</p>
                      <p className="font-mono text-[10.5px] text-ink-faint">Book an appointment</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-[13px] text-ink mb-0.5">{preview.service.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-3">
                      Open times ·{' '}
                      {preview.date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {preview.slots.map((slot, i) => (
                        <div
                          key={slot}
                          className={`py-2.5 text-center text-[13px] font-mono rounded-md border tabular-nums ${
                            i === 0 ? 'bg-accent text-white border-accent' : 'border-line-strong text-ink'
                          }`}
                        >
                          {new Date(slot).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-line bg-paper font-mono text-[10.5px] text-ink-faint">
                    Live data from a real booking page →
                  </div>
                </a>
              </Reveal>
            )}

            <Reveal delay={100}>
              <h2 className="font-display text-3xl text-ink mb-4 leading-snug">
                Real availability, <span className="italic">not a guessing game.</span>
              </h2>
              <p className="text-[14px] text-ink-soft leading-relaxed mb-6">
                Customers see genuinely open slots based on your hours, existing bookings,
                and buffer times. No double-bookings. No confusion. Just trust.
              </p>
              <div className="space-y-3">
                {[
                  'Slots update instantly as bookings come in',
                  'Respects your working hours and buffer times',
                  'Customers book in under 30 seconds, no account needed',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-px h-5 bg-line-strong mt-0.5 shrink-0" />
                    <p className="text-[13.5px] text-ink-soft">{item}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <Reveal className="mb-12">
          <h2 className="font-display text-3xl text-ink mb-2">
            Everything you need, <span className="italic">nothing you don't.</span>
          </h2>
          <p className="text-[14px] text-ink-soft max-w-md">
            Built for how small businesses actually work.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 border border-line rounded-md overflow-hidden">
          {features.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={index * 50}
              className={`p-6 ${index < 3 ? 'border-b border-line' : ''} ${
                (index + 1) % 3 !== 0 ? 'md:border-r border-line' : ''
              }`}
            >
              <div className="h-5 w-5 text-ink-soft mb-3">{feature.icon}</div>
              <h3 className="text-[14px] font-semibold text-ink mb-1">{feature.title}</h3>
              <p className="text-[12.5px] text-ink-faint leading-relaxed">{feature.description}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-y border-line bg-surface/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
          <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="font-display text-3xl text-ink mb-4 leading-snug">
                Built for businesses that
                <br />
                <span className="italic">take appointments.</span>
              </h2>
              <p className="text-[14px] text-ink-soft leading-relaxed">
                Whether you run a salon, clinic, tutoring service, or consulting practice,
                if your customers need to book time with you, this is for you.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {businessTypes.map((biz) => (
                <div
                  key={biz}
                  className="px-4 py-3 rounded-md border border-line bg-surface text-[13px] text-ink-soft"
                >
                  {biz}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20 text-center">
        <Reveal>
          <h2 className="font-display text-4xl text-ink mb-3">
            Ready to take <span className="italic">bookings?</span>
          </h2>
          <p className="text-[14px] text-ink-soft mb-8 max-w-sm mx-auto">
            Set up your booking page in under two minutes. Free to start.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-[14px] font-semibold text-white bg-accent hover:opacity-90 transition-opacity"
          >
            Get started free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-accent flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">LD</span>
            </div>
            <span className="font-mono text-[11px] text-ink-faint">
              LD Solutions, appointment booking for small business
            </span>
          </div>
          <Link href="/signup" className="text-[12px] text-ink-faint hover:text-ink transition-colors">
            Sign up
          </Link>
        </div>
      </footer>
    </div>
  );
}
