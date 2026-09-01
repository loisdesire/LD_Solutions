import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/Reveal';
import OwnerChatDemo from '@/components/OwnerChatDemo';
import BeforeAfterCompare from '@/components/BeforeAfterCompare';
import DashboardPreview from '@/components/DashboardPreview';
import LandingMobileNav from '@/components/LandingMobileNav';
import Button from '@/components/Button';
import { SITE_URL, DEMO_SLUG } from '@/lib/site';
import { PLAN_PRICE_NGN, PLAN_LABEL } from '@/lib/subscription';
import { formatMoney } from '@/lib/formatMoney';
import { safeJsonLdString } from '@/lib/jsonLd';

export const metadata: Metadata = {
  // The root layout uses `template: '%s'`, so a page title replaces the
  // brand entirely rather than appending it - the homepage was therefore
  // rendering with no brand name in the tab or in search results at all.
  title: 'Vanova | An AI receptionist for appointment businesses',
  description:
    'Your customers ask for a time, the AI checks real availability and books it. Live on your website and Telegram. Every booking lands on one dashboard. 14 days free.',
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

// WhatsApp/Messenger deliberately left off entirely here - not even a
// "coming soon" - until Meta App Review actually clears (still
// pending, no date as of this writing). Promoting a
// channel that isn't live yet on the page most likely to set a
// prospective owner's first expectation isn't worth it; add them back
// once there's a real date. Doesn't touch the admin Channels page
// (components/BotIntegrationsSettings.tsx), where they still need to
// stay visible - an owner can already start connecting either one
// ahead of approval landing.
const CHANNELS: { label: string; status: 'live' | 'soon' }[] = [
  { label: 'Website chat', status: 'live' },
  { label: 'Telegram', status: 'live' },
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
    description: 'No forms, no menus. They ask, it checks, it books.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
    title: 'Never double-books',
    description: 'Checks your hours, buffers, and existing bookings before confirming anything.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ),
    title: 'Confirms itself',
    description: 'They get an email the moment they book. You never follow up.',
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
    title: 'Lands in one dashboard',
    description: 'Website or Telegram, it all lands in the same place.',
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
    title: 'Looks like your business',
    description: 'Your logo, colors, and content, all yours.',
  },
  {
    // Was "Team management" - a real feature, but the most generic of the
    // six and the least tied to what actually sets Vanova apart. The
    // owner-side chat (OwnerChatDemo, right above this section) had a full
    // dedicated demo but wasn't in this summary anywhere - swapped in here
    // so the grid actually accounts for its own hero moment.
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 018.5-8.5h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
    title: 'Run your business by chat',
    description: 'Add a service, change your hours. Just tell your assistant.',
  },
];

// A real sequence - this is the one place on the page a numbered list
// actually earns its keep, since these four things genuinely happen in
// this order, not four unrelated feature bullets.
// Mirrors what the code actually gates. hasBusinessIntelligence() guards
// exactly two things - the analytics half of the owner's assistant and the
// customer bot's get_popular_services tool - so everything else belongs in
// Core. Payments, custom domains and rescheduling are deliberately NOT
// upsells.
const CORE_INCLUDES = [
  'AI receptionist on your website (Telegram included)',
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
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(homepageJsonLd) }}
      />
      {/* Nav - sentence-case links, not the tiny-mono-uppercase treatment
          the whole previous system defaulted to for every label. */}
      <nav
        className="relative sticky top-0 z-50 border-b border-line backdrop-blur-md"
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
            <LandingMobileNav demoHref={`/${DEMO_SLUG}`} />
          </div>
        </div>
      </nav>

      {/* Hero - third structural pass. A two-column layout with a demo
          visual on the right (chat replay, then a stat card, then a
          calendar) never landed after three genuinely different attempts -
          each one either repeated a beat another section already covers or
          just didn't read as attractive/legible on its own. Rather than a
          fourth guess, this drops the visual entirely: centered headline,
          subhead, and CTAs, nothing competing for attention before the
          visitor has even decided to care. Plenty of strong SaaS pages
          carry a hero on copy and a clear CTA alone. */}
      <section className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-12 sm:pb-20 text-center">
        <Reveal eager>
          <h1 className="font-display leading-[1.05] tracking-[-0.03em] font-semibold text-ink mb-4 sm:mb-5 mx-auto text-[clamp(2.2rem,4vw,3.3rem)]">
            An AI receptionist that <span style={{ color: 'var(--accent)' }}>actually books</span> the appointment.
          </h1>

          <p className="text-[15px] sm:text-[16px] text-ink-soft leading-relaxed mb-6 sm:mb-8 max-w-md mx-auto">
            Customers ask for a time on your website or Telegram. Vanova checks your real
            calendar and confirms it, no back-and-forth, 24/7.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3.5">
            <Button href="/signup" size="lg" className="justify-center w-full sm:w-auto">
              Start free<span className="hidden sm:inline">&nbsp;for 14 days</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Button>
            <Button href={`/${DEMO_SLUG}`} variant="outline" size="lg" className="justify-center w-full sm:w-auto">
              Try live demo
            </Button>
          </div>

          <a
            href="/api/demo-login"
            className="inline-flex items-center gap-1.5 mt-4 text-[14px] font-medium text-ink-faint hover:text-ink transition-colors"
          >
            Or explore the dashboard, no signup needed
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </a>
        </Reveal>
      </section>

      {/* Product proof through the actual system loop—not invented customer
          counts or testimonials the business does not have yet. The dark
          interruption also gives the long warm page a deliberate visual
          signature: a message visibly travels into a confirmed booking.
          Carries the nav's "How it works" anchor - this section now IS the
          answer to that question; a second "From message to booked" section
          further down told the identical four-step story in near-identical
          words (They ask/It checks/It books/You see it vs. this section's
          own Customer asks/Vanova checks/slot secured/confirmed) right
          after this one, which read as the page repeating itself rather
          than building. Removed rather than differentiated - this version
          already does the job better (real moments, not paragraph cards). */}
      <section id="how-it-works" className="bg-secondary-dark text-white border-y border-black/20">
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

          {/* Each card now shows the actual moment, not just a description of
              it - a real chat bubble, a real checklist, a real "held" chip, a
              real confirmed-booking chip, styled off the same product these
              represent (WebChatWidget's bubbles, OwnerChatDemo's booked
              chip) rather than four identical paragraph blocks. Numbered
              because this genuinely is a sequence, not decoration - no
              connecting arrows between them, the moments read as a sequence
              on their own. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                number: '01',
                title: 'Customer asks',
                copy: 'In plain language, on your website or a connected channel.',
                moment: (
                  <div className="inline-block rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] text-white/90 bg-white/10">
                    &ldquo;Can I come tomorrow around 2?&rdquo;
                  </div>
                ),
              },
              {
                number: '02',
                title: 'Vanova checks',
                copy: 'Your active services, opening hours, rules, and existing bookings.',
                moment: (
                  <div className="flex flex-col gap-1.5">
                    {['Calendar', 'Services & hours', 'Existing bookings'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-[12px] text-white/70">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }} aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        {item}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                number: '03',
                title: 'The slot is secured',
                copy: 'Vanova prevents double bookings, even when two customers request the same time.',
                moment: (
                  <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: 'var(--accent)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }} aria-hidden="true">
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 018 0v3" />
                    </svg>
                    <span className="font-mono text-[12px] text-white/85">2:30 PM held</span>
                  </div>
                ),
              },
              {
                number: '04',
                title: 'The booking is confirmed',
                copy: 'The customer gets confirmation, and the appointment appears on your dashboard.',
                moment: (
                  <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--accent)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="text-[12px] font-semibold text-white">Amaka · Tomorrow, 2:30 PM</span>
                  </div>
                ),
              },
            ].map(({ number, title, copy, moment }, index) => (
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
                  <h3 className="font-display text-[19px] font-semibold mt-6 mb-4">{title}</h3>
                  <div className="mb-4">{moment}</div>
                  <p className="text-[13px] leading-relaxed text-white/60">{copy}</p>
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
            {/* Was three stacked clauses ("what's coming up, who's next, how
                the day is shaping up") describing exactly what the mockup
                on the right already shows - the image does that job now. */}
            <p className="text-[15px] text-ink-soft leading-relaxed mb-0 max-w-md">
              Once the AI books an appointment, it appears here automatically. Nothing to chase, nothing to check.
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
            The same customer, asking the same question, with and without Vanova.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <BeforeAfterCompare />
        </Reveal>
        </div>
      </section>

      {/* The owner's side of the same idea the hero opens with - that one
          shows a customer talking to the AI to book; this shows the
          business owner talking to the same kind of assistant to run the
          business itself. No explicit background (so it inherits the
          page's own paper tone), giving it a beat of its own after the
          warm-surface Before/After section above, rather than reading as
          a continuation of it. */}
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
              {/* Was three sentences re-explaining what the chat demo right
                  next to it already shows in action - "no settings page to
                  hunt through" and "shows you what's about to change" are
                  both just narrated versions of what's happening in the
                  demo. One line is enough; the demo does the rest. */}
              <p className="text-[15px] sm:text-[16px] text-ink-soft leading-relaxed mb-7 max-w-md">
                Add a service, change your hours, update your profile, straight from a chat on your dashboard.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  '"We\'re open till 8 on Fridays now"',
                  '"Turn on payments for bookings"',
                  '"Update my logo, just uploaded it"',
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
          {/* Examples dropped - the pill row right below already names eight
              business types; naming four more here just before it was the
              exact "text re-explains what the visual already shows" pattern
              trimmed elsewhere on this page. */}
          <p className="text-[15px] text-ink-soft leading-relaxed">
            If your customers need to book time with you, this is for you.
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
