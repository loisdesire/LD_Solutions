import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/Reveal';
import HeroAmbientSlots from '@/components/HeroAmbientSlots';
import BeforeAfterCompare from '@/components/BeforeAfterCompare';
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
  // Geo-modifier added deliberately - the title carried no Nigeria/Naira
  // signal at all despite that being a real, currently-unclaimed keyword
  // space against the global competitors (SimplyBook, Vagaro, Booksy)
  // that dominate the generic "AI receptionist" search results.
  title: 'Vanova | AI Receptionist for Nigerian Appointment Businesses',
  description:
    'Your customers ask for a time, the AI checks real availability and books it - in Naira, on Paystack. Live on your website and Telegram. Every booking lands on one dashboard. 14 days free.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Vanova | AI Receptionist for Nigerian Appointment Businesses',
    description:
      'Your customers ask for a time, the AI books it - in Naira, on Paystack. Every channel, one dashboard. 14 days free.',
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
    // owner-side chat is the page's own "run your business by chat"
    // section further up - swapped in here so the grid actually accounts
    // for its own dedicated section.
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

// Short labels + a small icon each, not the long compound names this had
// before ("Hair salons & barbershops", 25 characters) - those were the
// actual cause of the uneven-pill-height bug fixed earlier: a label that
// long can't fit on one line in a two-column layout no matter how the
// columns are built. Trimmed to what's still instantly recognizable at a
// glance; the page never claimed this was an exhaustive list anyway (see
// the trailing "+ whatever yours is" pill).
const businessTypes = [
  {
    label: 'Salons & barbers',
    icon: (
      <>
        <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
      </>
    ),
  },
  {
    label: 'Wellness clinics',
    icon: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
  },
  {
    label: 'Tutors & coaches',
    icon: <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />,
  },
  {
    label: 'Consultants',
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </>
    ),
  },
  {
    label: 'Photographers',
    icon: (
      <>
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
      </>
    ),
  },
  {
    label: 'Personal trainers',
    icon: (
      <>
        <line x1="8" y1="12" x2="16" y2="12" /><rect x="4" y="9" width="4" height="6" rx="1" /><rect x="16" y="9" width="4" height="6" rx="1" />
      </>
    ),
  },
  {
    label: 'Massage therapists',
    icon: (
      <>
        <circle cx="12" cy="5.5" r="2.2" /><ellipse cx="12" cy="13" rx="5.5" ry="2.6" /><ellipse cx="12" cy="18.5" rx="7.5" ry="2.4" />
      </>
    ),
  },
  {
    label: 'Music teachers',
    icon: (
      <>
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </>
    ),
  },
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
      {/* z-0 alongside relative, not just relative alone - this is the
          real reason HeroAmbientSlots was never actually visible. relative
          without an explicit z-index doesn't create a stacking context, so
          the grid's -z-10 wasn't resolving "behind this section's text" at
          all - it was resolving at the page ROOT, landing it behind the
          whole page's own bg-paper background. Boosting its opacity/colors
          earlier never touched the real bug: it was rendering at full
          brightness the entire time, just behind an opaque wall. z-0 gives
          this section its own stacking context, so -z-10 now means what it
          was always meant to mean. */}
      {/* lg:min-h-[calc(100vh-80px)] - fills the viewport below the sticky
          nav on desktop (80px is that nav's own real rendered height at
          desktop padding). Scoped to lg only, not sm/mobile - see the
          commit message for why mobile is staying content-hugging for
          now rather than getting the same treatment. */}
      {/* Trying to make the hero+strip fit exactly within one mobile
          screen (the previous pass here) was the wrong goal - it meant
          trimming padding until things felt cramped, chasing a fold
          position that varies by device anyway. A page that runs past
          one screen and asks for a scroll is completely normal; pt-12/
          pb-14 here gives the hero real breathing room again instead of
          being squeezed to fit above a line that was never fixed. */}
      <section className="relative z-0 pt-12 sm:pt-20 pb-14 sm:pb-20 lg:py-0 lg:min-h-[calc(100vh-80px)] lg:flex lg:items-center lg:justify-center text-center overflow-hidden">
        {/* Full section width, not the inner max-w-2xl column - the point
            is visible around the text's edges on a wide screen, which a
            container as narrow as the copy itself couldn't give it room
            to do. */}
        <HeroAmbientSlots />
        {/* Widened from max-w-2xl (both this column and the headline's own
            clamp cap were sized for the two-column layout this section
            used to have next to a demo visual - now that it's copy-only
            with a full-width page around it, that left a lot of dead
            horizontal space on a real desktop screen and made the text
            itself feel small/cautious against it, not just under-filled. */}
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
        <Reveal eager>
          <h1 className="font-display leading-[1.05] tracking-[-0.03em] font-semibold text-ink mb-4 sm:mb-5 mx-auto text-[clamp(2.2rem,4.6vw,3.8rem)]">
            An AI receptionist that <span style={{ color: 'var(--accent)' }}>actually books</span> the appointment.
          </h1>

          <p className="text-[16px] sm:text-[17.5px] text-ink-soft leading-relaxed mb-7 sm:mb-8 max-w-lg mx-auto">
            Customers ask for a time on your website or Telegram. Vanova checks your real
            calendar and confirms it, no back-and-forth, 24/7.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3.5">
            {/* Button's flex gap-2 applies between EVERY child - "Start
                free" and the conditional span used to be two separate
                flex items, so the gap inserted an extra 8px between "free"
                and "for 14 days" on top of the space already there.
                Wrapped as one span so the gap only lands where it should:
                between the whole text and the icon. */}
            <Button href="/signup" size="lg" className="justify-center w-full sm:w-auto">
              <span>Start free<span className="hidden sm:inline"> for 14 days</span></span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Button>
            <Button href={`/${DEMO_SLUG}`} variant="outline" size="lg" className="justify-center w-full sm:w-auto">
              Try live demo
            </Button>
          </div>
          {/* "Or explore the dashboard" dropped - within one mobile scroll
              this sat next to "Try live demo" (same idea, different
              destination) and "Test the live booking page" in the section
              right below (same idea again). Three "go try it" links in one
              screen was the actual complaint; "Try live demo" alone
              carries that job here. */}
        </Reveal>
        </div>
      </section>

      {/* Channel strip moved up, right after the hero - was sitting after
          the dark "how it works" section, which meant that (denser, more
          reading-heavy) section landed within the very first mobile
          scroll. Short and calm on purpose, so the how-it-works section
          still reads as something you scroll into rather than something
          dumped on you immediately - not because it's engineered to sit
          exactly at the fold (chasing that meant cramping the hero above
          it to fit a boundary that moves with every device anyway; a
          page that runs past one screen and asks for a scroll is normal). */}
      <section className="border-y border-line bg-warm-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-9">
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
          {/* The "Test the live booking page" link that used to sit here
              was the third "go try it" link within one scroll (after
              "Try live demo" in the hero and, before the reorder, the
              channel strip's own proximity) - dropped for the same reason
              the hero's "explore the dashboard" link was. */}
          <Reveal className="max-w-2xl mb-8">
            <p className="text-[13px] font-semibold text-white/60 mb-2">More than a chatbot</p>
            <h2 className="font-display text-[2rem] sm:text-4xl leading-tight">
              A real message goes all the way to <span className="italic" style={{ color: 'var(--accent)' }}>booked.</span>
            </h2>
          </Reveal>

          {/* Each card now shows the actual moment, not just a description of
              it - a real chat bubble, a real checklist, a real "held" chip, a
              real confirmed-booking chip, styled off the actual product
              (WebChatWidget's own bubble shapes and colors) rather than four
              identical paragraph blocks. Numbered
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

      {/* Owner's side moved to sit directly after How it works, not after
          Before/After - these two are the actual pair (the hero opens on
          a customer talking to the AI to book; this is the same idea
          from the owner's side, running the business by chat), and
          reading them back to back makes that pairing obvious instead of
          having Before/After's outcome-contrast section awkwardly wedged
          between two halves of one idea.

          Also replaced the chat-log mockup (tried twice this session,
          kept reading as the same chat-bubble device already used two
          sections up, reskinned) - but a first pass at removing it went
          too far the other way, down to a bare title + a description
          SENTENCE per item, which was an assertion asking to be believed
          rather than something explanatory. Each item now pairs its task
          with the actual literal phrase you'd type and what happens -
          the one thing that's genuinely explanatory - without any of the
          demo's own chrome (avatar, "online" badge, browser shell,
          typing animation) that made it feel like it was doing too much. */}
      <section className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
          {/* Side by side from lg up (was one stacked, centered column) -
              text and the capability list each get their own half instead
              of sharing one narrow column, so neither has to compress to
              fit above or below the other. Text stays centered below lg,
              where there's only room for one column anyway. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <Reveal className="max-w-md mx-auto lg:mx-0 text-center lg:text-left">
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] mb-3.5" style={{ color: 'var(--accent)' }}>
                The owner&rsquo;s side
              </div>
              {/* Sized up (2rem -> 2.25rem on mobile) - stacked on mobile,
                  this is the first thing the section shows with nothing
                  else to carry visual weight, so the old size read as
                  undersized on its own. */}
              <h2 className="font-display text-[2.25rem] sm:text-4xl leading-[1.12] text-ink mb-4">
                You don&rsquo;t fill out the form.
                <br />
                You just <span className="italic" style={{ color: 'var(--accent)' }}>say what you need.</span>
              </h2>
              <p className="text-[15px] sm:text-[16px] text-ink-soft leading-relaxed max-w-sm mx-auto lg:mx-0">
                Add a service, change your hours, update your profile, straight from a chat on your dashboard.
              </p>
            </Reveal>
            {/* One real change, shown fully - was a 3-item list of
                "quoted command -> arrow -> one-word result" chips, which
                turned out to be its own cliche: that exact device (fake
                command syntax, arrow, "Updated") is all over AI-product
                marketing right now, recognizable as a template independent
                of what product it's attached to, and two of the three
                results just said "Updated" with nothing concrete actually
                shown changing. This instead shows the real artifact: an
                actual hours table, the kind that's really on the admin
                Hours page, with the one row that changed genuinely
                different from its neighbours (background, weight) - proof
                you can see, not an assertion in a bubble or a chip. The
                one line tying it back to "you just said this" is real
                copy, not a fake command-syntax quote. */}
            <Reveal delay={70} className="max-w-sm mx-auto lg:mx-0 lg:max-w-none w-full">
              <div className="rounded-2xl border border-line-strong bg-surface overflow-hidden shadow-[0_20px_50px_-20px_var(--accent-soft)]">
                <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-semibold text-ink">Hours · This week</span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    Changed via chat
                  </span>
                </div>
                <div className="p-4 space-y-1">
                  {[
                    { day: 'Thursday', hours: '9:00 AM – 6:00 PM', changed: false },
                    { day: 'Friday', hours: '9:00 AM – 8:00 PM', changed: true },
                    { day: 'Saturday', hours: '10:00 AM – 4:00 PM', changed: false },
                  ].map((row) => (
                    <div
                      key={row.day}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-[13.5px] ${row.changed ? 'font-semibold' : 'text-ink-soft'}`}
                      style={row.changed ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
                    >
                      <span>{row.day}</span>
                      <span className="tabular-nums">{row.hours}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3.5 border-t border-dashed border-line">
                  <p className="text-[12.5px] text-ink-faint leading-relaxed">
                    &ldquo;We&rsquo;re open till 8 on Fridays now.&rdquo; That was the whole conversation.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
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
        {/* A single stacked column read as a long, plain list - a lot of
            scroll for eight short category names, and every pill the same
            shape start to finish is exactly the "boring" complaint. CSS
            columns-2 instead of the grid this was trying to be before:
            unlike grid, columns don't stretch every item in a row to
            match the tallest, so the earlier uneven-height bug (labels
            like "Hair salons & barbershops" wrapping to two lines and
            dragging their neighbour's box taller with them) can't happen
            here regardless of label length - each column just flows
            independently. display:flex from sm: naturally overrides
            multi-column layout on its own, so this doesn't need a
            separate sm+ variant. Icons added per category (not just
            trimmed labels) for real visual variety instead of a wall of
            identically-shaped text pills, and each pill sizes to its own
            content rather than stretching full width, so it reads as a
            loose tag cloud, not a form. */}
        <Reveal delay={80} className="columns-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
          {businessTypes.map((biz) => (
            <span
              key={biz.label}
              className="mb-3 sm:mb-0 flex items-center gap-2 break-inside-avoid rounded-full border border-line bg-surface px-3.5 py-2.5 sm:px-5 text-[12.5px] sm:text-[14px] font-medium text-ink-soft shadow-lift"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                {biz.icon}
              </svg>
              {biz.label}
            </span>
          ))}
          <span className="mb-3 sm:mb-0 flex items-center justify-center break-inside-avoid rounded-full border border-dashed border-line-strong px-3.5 py-2.5 sm:px-5 text-[12.5px] sm:text-[14px] font-medium text-ink-faint">
            + whatever yours is
          </span>
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
