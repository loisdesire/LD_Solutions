import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/Reveal';
import SlotGrid from '@/components/SlotGrid';
import SelfBookingDemo from '@/components/SelfBookingDemo';
import OwnerChatDemo from '@/components/OwnerChatDemo';
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
    title: 'Styled for your business',
    description: 'Use your logo, accent color, cover image, content, and URL on a booking page that keeps your business front and centre.',
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="Vanova" className="h-8 w-8 shrink-0 object-contain" />
            <span className="text-[15px] font-semibold text-ink tracking-tight">Vanova</span>
          </div>

          <div className="hidden md:flex items-center gap-7">
            <a href="#how-it-works" className="text-[14px] font-medium text-ink-soft hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#features" className="text-[14px] font-medium text-ink-soft hover:text-ink transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-[14px] font-medium text-ink-soft hover:text-ink transition-colors">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-5">
            <a
              href={`/${DEMO_SLUG}`}
              className="text-[14px] font-medium text-ink-soft hover:text-ink transition-colors hidden sm:inline"
            >
              Demo
            </a>
            <Button href="/signup" size="sm" className="min-h-[40px]">
              Start free
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
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 sm:pt-20 pb-12 sm:pb-20 overflow-hidden">
        <div className="hidden lg:block absolute -right-[6%] top-0 w-[52%] h-full -z-10">
          <SlotGrid className="h-full" />
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14 items-center">
          <Reveal eager>
            <h1 className="font-display leading-[1.05] tracking-[-0.03em] font-semibold text-ink mb-4 sm:mb-5 max-w-[560px] text-[clamp(2.2rem,4vw,3.3rem)]">
              An AI receptionist that <span style={{ color: 'var(--accent)' }}>actually books</span> the appointment.
            </h1>

            <p className="text-[15px] sm:text-[16px] text-ink-soft leading-relaxed mb-6 sm:mb-8 max-w-md">
              Customers ask for a time on your website or Telegram. Vanova checks your real
              calendar and confirms it, no back-and-forth, 24/7.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-center sm:gap-3.5">
              <Button href="/signup" size="lg" className="justify-center w-full">
                Start free<span className="hidden sm:inline">&nbsp;for 14 days</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Button>
              <Button href={`/${DEMO_SLUG}`} variant="outline" size="lg" className="justify-center w-full">
                Try live demo
              </Button>
            </div>

            <a
              href="/api/demo-login"
              className="inline-flex items-center gap-1.5 mt-4 text-[14px] font-medium text-ink-faint hover:text-ink transition-colors text-left"
            >
              Or explore the dashboard - no signup needed
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </a>
          </Reveal>

          <div className="relative">
            <Reveal eager delay={120} className="relative">
              <SelfBookingDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Product proof through the actual system loop—not invented customer
          counts or testimonials the business does not have yet. The dark
          interruption also gives the long warm page a deliberate visual
          signature: a message visibly travels into a confirmed booking. */}
      <section className="bg-secondary-dark text-white border-y border-black/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-16">
          <Reveal className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold text-white/60 mb-2">More than a chatbot</p>
              <h2 className="font-display text-[2rem] sm:text-4xl leading-tight">
                A real message goes all the way to <span className="italic" style={{ color: 'var(--accent)' }}>booked.</span>
              </h2>
            </div>
            <a href={`/${DEMO_SLUG}`} className="text-[14px] font-semibold text-white underline underline-offset-4 decoration-white/30 hover:decoration-white">
              Test the live booking page →
            </a>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['01', 'Customer asks', 'In plain language, on your website or a connected channel.'],
              ['02', 'Vanova checks', 'Your active services, opening hours, rules, and existing bookings.'],
              ['03', 'The slot is secured', 'The database blocks conflicting appointments—even if two people try at once.'],
              ['04', 'Everyone sees it', 'The customer gets confirmation and your dashboard updates.'],
            ].map(([number, title, copy], index) => (
              <Reveal key={title} delay={index * 60}>
                <div className="relative h-full rounded-2xl border border-white/15 bg-white/[0.06] p-5 sm:p-6">
                  {/* Real accent (#c74a1e), not the invented #f28a63 this
                      section originally shipped with - that color doesn't
                      exist anywhere else in the brand. Sized up a touch
                      from 13px and kept semibold so the label still clears
                      AA text contrast against this dark background (plain
                      accent-on-#171717 is ~3.8:1, enough for the larger
                      bold heading above but not for small text on its own). */}
                  <span className="font-display text-[14px] font-bold" style={{ color: 'var(--accent)' }}>{number}</span>
                  <h3 className="font-display text-[19px] font-semibold mt-6 mb-2">{title}</h3>
                  <p className="text-[14px] leading-relaxed text-white/65">{copy}</p>
                  {index < 3 && (
                    <span
                      className="hidden lg:flex absolute -right-2.5 top-8 z-10 h-5 w-5 items-center justify-center rounded-full text-accent-contrast text-[12px]"
                      style={{ background: 'var(--accent)' }}
                    >
                      →
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>


      {/* Channel strip - honest about what's live vs. coming, on purpose */}
      <section className="border-y border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-7 sm:py-9">
          <Reveal className="flex flex-col items-center text-center">
            <p className="text-[14px] font-medium text-ink-soft mb-4 sm:mb-5">
              One receptionist. Every channel your customers already use.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 gap-y-2.5 sm:gap-y-3">
              {CHANNELS.map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 text-[14px] font-medium">
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 items-center">
          <Reveal>
            <h2 className="font-display text-[2.1rem] sm:text-5xl text-ink mb-4 sm:mb-5 leading-[0.95] tracking-[-0.04em]">
              Your whole day, <span className="italic" style={{ color: 'var(--accent)' }}>at a glance.</span>
            </h2>
            <p className="text-[15px] text-ink-soft leading-relaxed mb-0 max-w-md">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
        <Reveal className="mb-8 sm:mb-12 max-w-xl mx-auto text-center">
          <h2 className="font-display text-[2rem] sm:text-3xl text-ink mb-3 leading-snug">
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
      <section id="how-it-works" className="border-y border-line bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-16">
          <Reveal className="mb-8 sm:mb-10 max-w-xl mx-auto text-center">
            <h2 className="font-display text-[2rem] sm:text-4xl text-ink mb-2">From message to <span className="italic" style={{ color: 'var(--accent)' }}>booked.</span></h2>
            <p className="text-[15px] text-ink-soft">A simple path from the first question to a confirmed appointment.</p>
          </Reveal>
          {/* Below sm: a real vertical timeline, not the sm:/lg: grid below
              with its connecting arrows just switched off. This IS a real
              sequence (the frontend-design skill's own rule: numbered
              markers earn their place only when order carries information -
              here it genuinely does), so on a phone it gets the idiomatic
              mobile shape for that: a connecting line and number badges
              running top to bottom, not four unlabelled paragraphs with a
              stray "01" in front of each. */}
          <div className="sm:hidden flex flex-col">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 60} className="flex gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center font-display text-[14px] font-bold shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && <span className="w-px flex-1 my-1" style={{ background: 'var(--line-strong)' }} />}
                </div>
                <div className={i < steps.length - 1 ? 'pb-8' : ''}>
                  <h3 className="font-display text-[18px] font-semibold text-ink leading-tight mb-1.5">{step.title}</h3>
                  <p className="text-[15px] text-ink-soft leading-relaxed">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8 lg:gap-x-12">
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

      {/* The owner's side of the same idea the hero opens with - that one
          shows a customer talking to the AI to book; this shows the
          business owner talking to the same kind of assistant to run the
          business itself. No explicit background (so it inherits the
          page's own paper tone, same as how-it-works right above it) -
          this reads as a direct continuation of that section, not a new
          chapter, since it's genuinely the second half of the same
          thought. */}
      <section className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <Reveal>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] mb-3.5" style={{ color: 'var(--accent)' }}>
                The owner&rsquo;s side
              </div>
              <h2 className="font-display text-[2rem] sm:text-4xl leading-[1.12] text-ink mb-4">
                You don&rsquo;t fill out the form.
                <br />
                You just <span className="italic" style={{ color: 'var(--accent)' }}>say what you need.</span>
              </h2>
              <p className="text-[15px] sm:text-[16px] text-ink-soft leading-relaxed mb-7 max-w-md">
                Add a service, change your hours, update your profile - straight from a chat, right on your
                dashboard. No settings page to hunt through. Tell it what you want, it shows you exactly what&rsquo;s
                about to change, and only saves once you say yes.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  '"We\'re open till 8 on Fridays now"',
                  '"Turn on payments for bookings"',
                  '"Change my logo" - just attach the photo',
                ].map((example) => (
                  <span
                    key={example}
                    className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper px-3.5 py-2 text-[13px] text-ink-soft"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                    {example}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={120}>
              <OwnerChatDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
          <Reveal className="mb-8 sm:mb-12 mx-auto text-center">
            <h2 className="font-display text-[2rem] sm:text-3xl text-ink mb-2 lg:whitespace-nowrap">
              The work gets lighter, <span className="italic" style={{ color: 'var(--accent)' }}>the bookings keep coming.</span>
            </h2>
            <p className="text-[15px] text-ink-soft">
              The essentials for running an appointment business, without the busywork around them.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 sm:gap-x-8 sm:gap-y-10">
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
        <Reveal className="mb-8 sm:mb-10 mx-auto text-center">
          <h2 className="font-display text-[2rem] sm:text-3xl text-ink mb-3 leading-snug lg:whitespace-nowrap">
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
              className="px-5 py-2.5 rounded-full border border-line bg-surface text-[14px] font-medium text-ink-soft shadow-lift"
            >
              {biz}
            </span>
          ))}
        </Reveal>
      </section>

      {/* Pricing - one plan, stated plainly, no tiers to compare */}
      <section id="pricing" className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
          <Reveal className="text-center mb-8 sm:mb-12">
            <h2 className="font-display text-[2rem] sm:text-3xl text-ink mb-2">Two plans. Both start free.</h2>
            <p className="text-[15px] text-ink-soft">
              Everything you need to take bookings is in the first one. The second adds an AI that answers questions about your business.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto items-stretch">
            <Reveal delay={80}>
              <div className="rounded-3xl bg-surface border border-line shadow-soft p-8 h-full flex flex-col">
                <div className="text-[14px] font-semibold text-ink-faint">
                  {PLAN_LABEL.core}
                </div>
                <div className="font-display text-[40px] font-bold text-ink leading-none mt-3">
                  {formatMoney(PLAN_PRICE_NGN.core)}
                  <span className="text-[15px] font-normal text-ink-faint"> /month</span>
                </div>
                <p className="text-[14px] text-ink-faint mt-2">14 days free, then billed monthly. Cancel anytime.</p>

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
                  className="absolute -top-3 left-8 rounded-full px-3 py-1 text-[12px] font-semibold text-accent-contrast"
                  style={{ background: 'var(--accent)' }}
                >
                  Most popular
                </span>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--accent)' }}>
                  {PLAN_LABEL.business_intelligence}
                </div>
                <div className="font-display text-[40px] font-bold text-ink leading-none mt-3">
                  {formatMoney(PLAN_PRICE_NGN.business_intelligence)}
                  <span className="text-[15px] font-normal text-ink-faint"> /month</span>
                </div>
                <p className="text-[14px] text-ink-faint mt-2">14 days free, then billed monthly. Cancel anytime.</p>

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

          <p className="text-center text-[14px] text-ink-faint mt-8">
            Not sure? Start on {PLAN_LABEL.core}. You can change plan from your dashboard later.
          </p>
        </div>
      </section>

      {/* CTA - the page's second and last dark beat, bookending the hero-
          adjacent proof section rather than repeating warm-surface again.
          Deliberately the only two dark moments on the page - a third
          (e.g. the footer too) would turn a signature into a pattern. */}
      <section className="bg-secondary-dark text-white border-t border-black/20">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 text-center">
          <Reveal>
            <h2 className="font-display text-4xl mb-8">
              Ready to stop typing <span className="italic" style={{ color: 'var(--accent)' }}>&ldquo;what time works?&rdquo;</span>
            </h2>
            <Button href="/signup">
              Start free for 14 days
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
                <img src="/logo.png" alt="Vanova" className="h-8 w-8 shrink-0 object-contain" />
                <span className="text-[14px] font-semibold text-ink tracking-tight">Vanova</span>
              </div>
              <p className="text-[14px] text-ink-soft leading-relaxed">
                An AI receptionist for appointment businesses. Your customers ask, it books.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <nav className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
                <a href="#how-it-works" className="text-[14px] text-ink-soft hover:text-ink transition-colors">How it works</a>
                <a href="#features" className="text-[14px] text-ink-soft hover:text-ink transition-colors">Features</a>
                <a href="#pricing" className="text-[14px] text-ink-soft hover:text-ink transition-colors">Pricing</a>
                <a href={`/${DEMO_SLUG}`} className="text-[14px] text-ink-soft hover:text-ink transition-colors">Live demo</a>
              </nav>
              <nav className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
                <Link href="/signup" className="text-[14px] text-ink-soft hover:text-ink transition-colors">Create an account</Link>
                <Link href="/login" className="text-[14px] text-ink-soft hover:text-ink transition-colors">Business login</Link>
                <Link href="/account/login" className="text-[14px] text-ink-soft hover:text-ink transition-colors">My bookings</Link>
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
