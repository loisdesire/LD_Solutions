import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/Reveal';
import SlotGrid from '@/components/SlotGrid';
import SelfBookingDemo from '@/components/SelfBookingDemo';
import BeforeAfterCompare from '@/components/BeforeAfterCompare';
import DashboardPreview from '@/components/DashboardPreview';
import Button from '@/components/Button';
import { SITE_URL, DEMO_SLUG } from '@/lib/site';
import { PLAN_PRICE_NGN, PLAN_LABEL } from '@/lib/subscription';
import { formatMoney } from '@/lib/formatMoney';

export const metadata: Metadata = {
  // The root layout uses `template: '%s'`, so a page title replaces the
  // brand entirely rather than appending it - the homepage was therefore
  // rendering with no brand name in the tab or in search results at all.
  title: 'Vanova | An AI receptionist for appointment businesses',
  description:
    'Your customers ask for a time, the AI checks real availability and books it. Live on your website and Telegram today, WhatsApp and Messenger coming soon. Every booking lands on one dashboard. 14 days free.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Vanova | An AI receptionist for appointment businesses',
    description:
      'Your customers ask for a time, the AI books it. Every channel, one dashboard. 14 days free.',
    url: SITE_URL,
    type: 'website',
  },
};

const homepageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Vanova',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description:
    'An AI booking receptionist that answers customer questions, checks real availability, and books appointments for service businesses.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: PLAN_PRICE_NGN.core,
    highPrice: PLAN_PRICE_NGN.business_intelligence,
    priceCurrency: 'NGN',
    offerCount: 2,
  },
  audience: {
    '@type': 'BusinessAudience',
    audienceType: 'Appointment-based small businesses',
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
    description: 'Website, Telegram, and soon WhatsApp. Wherever the message came from, it lands in the same place.',
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

// A real sequence - this is the one place on the page a numbered list
// actually earns its keep, since these four things genuinely happen in
// this order, not four unrelated feature bullets.
const steps = [
  { title: 'They ask', description: 'A customer messages you on your website, or on Telegram.' },
  { title: 'It checks', description: 'The AI checks your real availability, instantly, against your actual calendar.' },
  { title: 'It books', description: "It's confirmed and booked. No back-and-forth, no waiting on you." },
  { title: 'You see it', description: 'The appointment lands on your dashboard automatically. You never touch it.' },
];

// Mirrors what the code actually gates. hasBusinessIntelligence() guards
// exactly two things - the analytics half of the owner's assistant and the
// customer bot's get_popular_services tool - so everything else belongs in
// Core. Payments, custom domains and rescheduling are deliberately NOT
// upsells.
const CORE_INCLUDES = [
  'AI receptionist on your website (Telegram included, WhatsApp & Messenger coming)',
  'Unlimited bookings and services',
  'One dashboard for every appointment',
  'Automatic email confirmations and reminders',
  'Take deposits and payments with Paystack',
  'Your own branded booking page and custom domain',
  'Team accounts for your staff',
];

const BI_INCLUDES = [
  'Ask your data anything: revenue, top customers, busiest hours',
  'Spot cancellations, no-shows and customers drifting away',
  'Compare this month to last, in plain language',
  "Your AI tells customers what's actually popular, from real bookings",
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
    <div className="landing min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd) }}
      />
      {/* Nav - sentence-case links, not the tiny-mono-uppercase treatment
          the whole previous system defaulted to for every label. */}
      <nav
        className="sticky top-0 z-50 border-b border-line backdrop-blur-md"
        style={{ background: 'color-mix(in srgb, var(--paper) 82%, transparent)' }}
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <span className="text-accent-contrast text-[13px] font-bold">V</span>
            </div>
            <span className="text-[15px] font-semibold text-ink tracking-tight">Vanova</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            <a href="#how-it-works" className="text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#features" className="text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-5">
            <a
              href={`/${DEMO_SLUG}`}
              className="text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors hidden sm:inline"
            >
              See a live demo
            </a>
            <Button href="/signup" size="sm">
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero - went through an asymmetric/offset composition first
          (headline spanning full width on top, demo card offset below-
          right) to prove genuine compositional change rather than a
          recolored version of the old flush grid. In practice, from an
          actual screenshot, that read as two disconnected pieces with a
          big gap between them and made the page shape ungainly - a huge
          headline block, then a lopsided section under it. Back to a
          side-by-side layout, but not the SAME one: the distinctiveness
          now lives in the demo card itself (rotated, a floating proof
          chip breaking its corner, the SlotGrid signature behind it),
          not in fighting the two-column-ness of a hero, which is a
          legible, well-established pattern for a reason. */}
      <section className="relative max-w-6xl mx-auto px-6 lg:px-10 pt-14 sm:pt-20 pb-16 sm:pb-20 overflow-hidden">
        {/* The signature: a grid of time slots quietly filling in behind
            the demo card, not a gradient or a glow. Hidden below lg -
            there's no negative space for it to read as texture rather
            than clutter once the columns stack. */}
        <div className="hidden lg:block absolute -right-[6%] top-0 w-[52%] h-full -z-10">
          <SlotGrid className="h-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-14 items-center">
          <Reveal eager>
            {/* Was clamp(2.6rem, 6vw, 4.6rem) - up to 73.6px, wrapping to
                three lines and dominating most of the viewport height in
                the actual rendered page. Down to a size that still reads
                as a confident, bold headline without being the whole
                screen. */}
            <h1 className="font-display leading-[1.05] tracking-[-0.03em] font-semibold text-ink mb-5 max-w-[560px] text-[clamp(2.1rem,3.6vw,3.1rem)]">
              An AI receptionist that <span style={{ color: 'var(--accent)' }}>actually books</span> the appointment.
            </h1>

            <p className="text-[16px] text-ink-soft leading-relaxed mb-8 max-w-md">
              Customers ask for a time on your website or Telegram. Vanova checks your real
              calendar and confirms it, no back-and-forth, 24/7.
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <Button href="/signup" size="lg">
                Start free for 14 days
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Button>
              <Button href={`/${DEMO_SLUG}`} variant="outline" size="lg">
                See it live
              </Button>
            </div>

            {/* "See it live" only ever showed the customer's side of this -
                book an appointment, chat with the AI. The other half of
                the pitch is what the business owner sees every morning,
                and there was no way to show that without asking someone
                to sign up first. This drops a visitor straight into the
                real admin, logged in, no signup - same underlying account
                every time, so nothing here is ever actually saved. */}
            <a
              href="/api/demo-login"
              className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-medium text-ink-faint hover:text-ink transition-colors"
            >
              Or see the dashboard - no signup needed
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </a>
          </Reveal>

          {/* Side-by-side with the text now, not offset below it. The
              rotation and the floating "Booked in 6 messages" proof
              chip that used to sit here were both dropped - templated
              SaaS-hero tells rather than anything specific to this
              product. The SlotGrid texture behind it and the demo card
              itself (which is real product UI, not a mockup) already
              earn the "this is a real object" read without them. */}
          <div className="relative">
            <Reveal eager delay={120} className="relative">
              <SelfBookingDemo />
            </Reveal>
          </div>
        </div>
      </section>


      {/* Channel strip - honest about what's live vs. coming, on purpose */}
      <section className="border-y border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-9">
          <Reveal className="flex flex-col items-center text-center">
            <p className="text-[13px] font-medium text-ink-faint mb-5">
              One receptionist. Every channel your customers already use.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {CHANNELS.map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 text-[13px] font-medium">
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

      {/* Dashboard preview follows the channel separation: customers ask,
          the AI books, and the owner sees the appointment immediately. */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-14 items-center">
          <Reveal>
            <h2 className="font-display text-4xl sm:text-5xl text-ink mb-5 leading-[0.95] tracking-[-0.04em]">
              Your whole day, <span className="italic" style={{ color: 'var(--accent)' }}>at a glance.</span>
            </h2>
            <p className="text-[15px] text-ink-soft leading-relaxed mb-6 max-w-md">
              Once the AI books an appointment, it appears here automatically. See what&rsquo;s
              coming up, who&rsquo;s next, and how the day is shaping up without chasing messages
              or checking calendars.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      {/* Before / after */}
      <section className="border-t border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <Reveal className="mb-12 max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl text-ink mb-3 leading-snug">
            Same question. <span style={{ color: 'var(--accent)' }}>Very different wait.</span>
          </h2>
          <p className="text-[15px] text-ink-soft leading-relaxed">
            This is the actual difference an AI receptionist makes, not a feature list, just
            the same customer asking the same thing.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <BeforeAfterCompare />
        </Reveal>
        </div>
      </section>

      {/* How it works - a connected path keeps the sequence feeling like one
          process instead of four separate feature cards. */}
      <section id="how-it-works" className="border-y border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16 sm:py-16">
          <Reveal className="mb-10 max-w-xl mx-auto text-center">
            <h2 className="font-display text-3xl sm:text-4xl text-ink mb-2">From message to <span className="italic" style={{ color: 'var(--accent)' }}>booked.</span></h2>
            <p className="text-[15px] text-ink-soft">A simple path from the first question to a confirmed appointment.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-9 lg:gap-x-12">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 60} className="relative">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-display text-[24px] font-normal leading-none" style={{ color: 'var(--accent)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-display text-[20px] font-normal text-ink leading-tight">{step.title}</h3>
                </div>
                <p className="text-[15px] text-ink-soft leading-relaxed max-w-[230px]">{step.description}</p>
                {i < steps.length - 1 && (
                  <svg aria-hidden="true" className="hidden lg:block absolute -right-5 top-1/2 -translate-y-1/2 w-11 h-3 text-ink-faint" viewBox="0 0 44 12" fill="none">
                    <path d="M1 6h38M35 1l5 5-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
          <Reveal className="mb-12 mx-auto text-center">
            <h2 className="font-display text-3xl text-ink mb-2 lg:whitespace-nowrap">
              The work gets lighter, <span className="italic" style={{ color: 'var(--accent)' }}>the bookings keep coming.</span>
            </h2>
            <p className="text-[15px] text-ink-soft">
              The essentials for running an appointment business, without the busywork around them.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {features.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 50}>
                <div className="h-full border-t-2 border-line pt-5">
                  <div className="flex items-start gap-3.5">
                    <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center mt-0.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      <div className="h-[16px] w-[16px]">{feature.icon}</div>
                    </div>
                    <div>
                      <h3 className="font-display text-[18px] font-semibold text-ink mb-1.5">{feature.title}</h3>
                      <p className="text-[15px] text-ink-soft leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <Reveal className="mb-10 mx-auto text-center">
          <h2 className="font-display text-3xl text-ink mb-3 leading-snug lg:whitespace-nowrap">
            Built for businesses that <span className="italic">take appointments.</span>
          </h2>
          <p className="text-[15px] text-ink-soft leading-relaxed">
            Whether you run a salon, clinic, tutoring service, or consulting practice,
            if your customers need to book time with you, this is for you.
          </p>
        </Reveal>
        <Reveal delay={80} className="flex flex-wrap justify-center gap-3">
          {businessTypes.map((biz) => (
            <span
              key={biz}
              className="px-5 py-2.5 rounded-full border border-line bg-surface text-[13px] font-medium text-ink-soft shadow-lift"
            >
              {biz}
            </span>
          ))}
        </Reveal>
      </section>

      {/* Pricing - one plan, stated plainly, no tiers to compare */}
      <section id="pricing" className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
          <Reveal className="text-center mb-12">
            <h2 className="font-display text-3xl text-ink mb-2">Two plans. Both start free.</h2>
            <p className="text-[15px] text-ink-soft">
              Everything you need to take bookings is in the first one. The second adds an AI that answers questions about your business.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto items-stretch">
            <Reveal delay={80}>
              <div className="rounded-3xl bg-surface border border-line shadow-soft p-8 h-full flex flex-col">
                <div className="text-[13px] font-semibold text-ink-faint">
                  {PLAN_LABEL.core}
                </div>
                <div className="font-display text-[40px] font-bold text-ink leading-none mt-3">
                  {formatMoney(PLAN_PRICE_NGN.core)}
                  <span className="text-[15px] font-normal text-ink-faint"> /month</span>
                </div>
                <p className="text-[13px] text-ink-faint mt-2">14 days free, then billed monthly. Cancel anytime.</p>

                <div className="text-left mt-7 space-y-3 flex-1">
                  {CORE_INCLUDES.map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                      <span className="text-body-sm text-ink-soft">{item}</span>
                    </div>
                  ))}
                </div>

                <Button href="/signup" variant="outline" className="mt-8 w-full">
                  Start free for 14 days
                </Button>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="rounded-3xl bg-surface border-2 border-accent shadow-card p-8 h-full flex flex-col relative">
                <span
                  className="absolute -top-3 left-8 rounded-full px-3 py-1 text-[11px] font-semibold text-accent-contrast"
                  style={{ background: 'var(--accent)' }}
                >
                  Most popular
                </span>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
                  {PLAN_LABEL.business_intelligence}
                </div>
                <div className="font-display text-[40px] font-bold text-ink leading-none mt-3">
                  {formatMoney(PLAN_PRICE_NGN.business_intelligence)}
                  <span className="text-[15px] font-normal text-ink-faint"> /month</span>
                </div>
                <p className="text-[13px] text-ink-faint mt-2">14 days free, then billed monthly. Cancel anytime.</p>

                <div className="text-left mt-7 space-y-3 flex-1">
                  <p className="text-body-sm font-semibold text-ink">Everything in {PLAN_LABEL.core}, plus:</p>
                  {BI_INCLUDES.map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                      <span className="text-body-sm text-ink-soft">{item}</span>
                    </div>
                  ))}
                </div>

                <Button href="/signup" className="mt-8 w-full">
                  Start free for 14 days
                </Button>
              </div>
            </Reveal>
          </div>

          <p className="text-center text-[13px] text-ink-faint mt-8">
            Not sure? Start on {PLAN_LABEL.core}. You can change plan from your dashboard later.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 text-center">
          <Reveal>
            <h2 className="font-display text-4xl text-ink mb-8">
              Ready to stop typing <span className="italic">&ldquo;what time works?&rdquo;</span>
            </h2>
            <Button href="/signup">
              Start free trial
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* Footer - deliberately not a four-column link directory. That
          pattern is exactly the "generic template" look the rest of the
          page has been avoiding, and boxed against the CTA section right
          above it (same bg-warm-surface), it just read as one undifferentiated
          block with a hairline in the middle. Plain bg-paper gives it real
          separation; links sit as two quiet grouped rows instead of
          column headers, closer to how the rest of this page actually talks. */}
      <footer className="border-t border-line bg-paper">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-14 pb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 mb-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <span className="text-accent-contrast text-[13px] font-bold">V</span>
                </div>
                <span className="text-[14px] font-semibold text-ink tracking-tight">Vanova</span>
              </div>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                An AI receptionist for appointment businesses. Your customers ask, it books.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <nav className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
                <a href="#how-it-works" className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">How it works</a>
                <a href="#features" className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">Features</a>
                <a href="#pricing" className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">Pricing</a>
                <a href={`/${DEMO_SLUG}`} className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">Live demo</a>
              </nav>
              <nav className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
                <Link href="/signup" className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">Create an account</Link>
                <Link href="/login" className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">Business login</Link>
                <Link href="/account/login" className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">My bookings</Link>
              </nav>
            </div>
          </div>

          <div className="border-t border-line pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12.5px] text-ink-faint">
              © {new Date().getFullYear()} Vanova Hub. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <Link href="/terms" className="text-[12.5px] text-ink-faint hover:text-ink-soft transition-colors">Terms</Link>
              <Link href="/privacy" className="text-[12.5px] text-ink-faint hover:text-ink-soft transition-colors">Privacy</Link>
              <p className="text-[12.5px] text-ink-faint">/{DEMO_SLUG} is a live demo, not a real business</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
