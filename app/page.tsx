import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/Reveal';
import SelfBookingDemo from '@/components/SelfBookingDemo';
import BeforeAfterCompare from '@/components/BeforeAfterCompare';
import { SITE_URL } from '@/lib/site';
import { MONTHLY_PRICE_NGN } from '@/lib/subscription';

const DEMO_SLUG = 'glow-salon';

export const metadata: Metadata = {
  title: 'An AI receptionist for appointment businesses',
  description:
    'Your customers ask for a time, the AI checks real availability and books it — on your website today, Telegram today, WhatsApp and Messenger next. Every booking lands on one dashboard. 14 days free.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'An AI receptionist for appointment businesses',
    description:
      'Your customers ask for a time, the AI books it. Every channel, one dashboard. 14 days free.',
    url: SITE_URL,
    type: 'website',
  },
};

const CHANNELS = [
  { label: 'Website chat', status: 'live' as const },
  { label: 'Telegram', status: 'live' as const },
  { label: 'WhatsApp', status: 'soon' as const },
  { label: 'Messenger', status: 'soon' as const },
];

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v12H8l-4 4V4z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    ),
    title: 'Customers just ask',
    description: 'No forms, no menus. They type what they want, the AI checks real availability and books it.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
    title: 'Real-time availability',
    description: 'Respects your hours, buffer times, and existing bookings. No double-bookings, ever.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ),
    title: 'Automatic confirmations',
    description: 'The moment someone books, they get an email confirming it. You never have to follow up.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="3" y="13" width="7" height="7" rx="1.5" />
        <rect x="14" y="13" width="7" height="7" rx="1.5" />
      </svg>
    ),
    title: 'Every booking, one dashboard',
    description: 'Website, Telegram, and soon WhatsApp — wherever the message came from, it lands in the same place.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
    title: 'Your brand, your page',
    description: 'Your own accent color, logo, and URL. It reads as your business, not a template.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
        <circle cx="9" cy="11" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M17 3.13A4 4 0 0117 11" />
      </svg>
    ),
    title: 'Team management',
    description: 'Invite staff by email, manage roles, and let your whole team work off one shared calendar.',
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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <nav className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <span className="text-white text-[11px] font-bold">LD</span>
            </div>
            <span className="text-[14px] font-semibold text-ink tracking-tight">LD Solutions</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href={`/${DEMO_SLUG}`}
              className="text-[13.5px] text-ink-soft hover:text-ink transition-colors hidden sm:inline"
            >
              See a live demo
            </a>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-full text-[13.5px] font-semibold text-white bg-accent shadow-sm hover:opacity-90 transition-all active:scale-95"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pt-16 sm:pt-20 pb-16 sm:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-14 items-center">
          <Reveal>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-px w-8 bg-line-strong" />
              <span className="font-mono text-[11px] text-ink-faint uppercase tracking-[0.14em]">
                AI receptionist for appointment businesses
              </span>
            </div>

            <h1 className="font-display leading-[1.12] mb-6">
              <span className="block text-[28px] sm:text-[34px] text-ink-soft font-medium">
                &ldquo;Got anything free tomorrow?&rdquo;
              </span>
              <span className="block text-[40px] sm:text-[52px] font-bold mt-1" style={{ color: 'var(--accent)' }}>
                Already booked.
              </span>
            </h1>

            <p className="text-[16px] text-ink-soft leading-relaxed mb-8 max-w-md">
              An AI receptionist answers your customers on your website and Telegram right
              now — checks your real availability, books it, and puts it straight on your
              dashboard. You never touch the back-and-forth.
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold text-white bg-accent shadow-sm hover:opacity-90 transition-all active:scale-95"
              >
                Start free for 14 days
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href={`/${DEMO_SLUG}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-medium text-ink border-2 border-line-strong hover:border-accent hover:text-accent transition-colors"
              >
                See it live
              </a>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <SelfBookingDemo />
          </Reveal>
        </div>
      </section>

      {/* Channel strip — honest about what's live vs. coming, on purpose */}
      <section className="border-y border-line bg-surface/60">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6">
          <Reveal className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <p className="text-[13px] text-ink-soft shrink-0">
              One receptionist. Every channel your customers already use.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {CHANNELS.map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.05em]">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: c.status === 'live' ? 'var(--accent)' : 'var(--line-strong)' }}
                  />
                  <span className={c.status === 'live' ? 'text-ink' : 'text-ink-faint'}>{c.label}</span>
                  {c.status === 'soon' && <span className="text-ink-faint">· soon</span>}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Before / after */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <Reveal className="mb-10 max-w-lg">
          <h2 className="font-display text-3xl text-ink mb-3 leading-snug">
            Same question. <span style={{ color: 'var(--accent)' }}>Very different wait.</span>
          </h2>
          <p className="text-[14px] text-ink-soft leading-relaxed">
            This is the actual difference an AI receptionist makes — not a feature list, just
            the same customer asking the same thing.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <BeforeAfterCompare />
        </Reveal>
      </section>

      {/* Features */}
      <section className="border-y border-line bg-surface/60">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
          <Reveal className="mb-12">
            <h2 className="font-display text-3xl text-ink mb-2">
              Everything you need, <span className="italic">nothing you don&rsquo;t.</span>
            </h2>
            <p className="text-[14px] text-ink-soft max-w-md">
              Built for how small businesses actually work.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 50}>
                <div className="h-full rounded-2xl bg-surface border-2 border-line p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-18px_rgba(36,28,24,0.18)]">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <div className="h-[18px] w-[18px]">{feature.icon}</div>
                  </div>
                  <h3 className="text-[14.5px] font-semibold text-ink mb-1.5">{feature.title}</h3>
                  <p className="text-[13px] text-ink-faint leading-relaxed">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
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
                className="px-4 py-3 rounded-xl border-2 border-line bg-surface text-[13px] text-ink-soft"
              >
                {biz}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="border-t border-line bg-surface/60">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 text-center">
          <Reveal>
            <h2 className="font-display text-4xl text-ink mb-3">
              Ready to stop typing <span className="italic">&ldquo;what time works?&rdquo;</span>
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 max-w-sm mx-auto">
              14 days free, then ₦{MONTHLY_PRICE_NGN.toLocaleString()}/month. Cancel anytime.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold text-white bg-accent shadow-sm hover:opacity-90 transition-all active:scale-95"
            >
              Start free trial
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">LD</span>
            </div>
            <span className="font-mono text-[11px] text-ink-faint">
              LD Solutions — an AI receptionist for appointment businesses
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
