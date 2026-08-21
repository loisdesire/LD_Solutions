import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/Reveal';
import SelfBookingDemo from '@/components/SelfBookingDemo';
import DashboardPreview from '@/components/DashboardPreview';
import Button from '@/components/Button';
import { SITE_URL } from '@/lib/site';
import { PLAN_PRICE_NGN } from '@/lib/subscription';

const DEMO_SLUG = 'glow-salon';

export const metadata: Metadata = {
  title: 'Vanova Hub | Your business has a digital front desk',
  description:
    'Vanova Hub answers customer booking requests, checks your real availability, confirms appointments, and keeps your schedule organized — so you can focus on running your business.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Vanova Hub | Digital Front Desk for Appointment Businesses',
    description:
      'Customers ask. Vanova answers. Appointments get booked. Intelligent digital receptionist for salons, clinics, coaches, and studios.',
    url: SITE_URL,
    type: 'website',
  },
};

const homepageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Vanova Hub',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description:
    'Digital front desk for appointment-based businesses that answers customer booking requests, checks real availability, and confirms appointments automatically.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: PLAN_PRICE_NGN.core,
    highPrice: PLAN_PRICE_NGN.business_intelligence,
    priceCurrency: 'NGN',
    offerCount: 2,
  },
  audience: {
    '@type': 'BusinessAudience',
    audienceType: 'Appointment-based service businesses',
  },
};

const AUDIENCE_TAGS = [
  'Salons',
  'Barbers',
  'Coaches',
  'Consultants',
  'Photographers',
  'Wellness',
  'Studios',
  'Clinics',
];

const BUSINESS_TYPES = [
  { title: 'Salon', desc: 'Hair, nails & beauty studios handling high daily client inquiries.', icon: '✂️' },
  { title: 'Barbershop', desc: 'Fast, seamless appointment booking without stopping a haircut.', icon: '💈' },
  { title: 'Beauty & Wellness', desc: 'Spas, skincare & massage therapists requiring calm scheduling.', icon: '🌿' },
  { title: 'Coach', desc: 'Executive, life, and career coaches managing recurring 1:1 sessions.', icon: '🎯' },
  { title: 'Consultant', desc: 'Advisors and strategists booking paid client consultations.', icon: '📊' },
  { title: 'Photographer', desc: 'Studio & portrait photographers scheduling shoots & viewings.', icon: '📷' },
  { title: 'Personal Trainer', desc: 'Fitness coaches managing workout sessions & client slots.', icon: '⚡' },
  { title: 'Clinic / Therapist', desc: 'Private medical, dental & health practitioners.', icon: '🩺' },
];

const CHANNELS = [
  {
    name: 'Website Chat',
    status: 'Live & Integrated',
    desc: 'Conversational booking assistant embedded directly on your branded website.',
    active: true,
  },
  {
    name: 'Telegram Bot',
    status: 'Live & Integrated',
    desc: 'Instant messaging booking assistant active 24/7 inside Telegram.',
    active: true,
  },
  {
    name: 'WhatsApp Business',
    status: 'Channel Connector',
    desc: 'Connect your business WhatsApp number to handle client requests.',
    active: false,
  },
  {
    name: 'Facebook Messenger',
    status: 'Channel Connector',
    desc: 'Receive booking requests directly from your Facebook Business page.',
    active: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-body selection:bg-accent/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd) }}
      />

      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center font-display font-bold text-base shadow-sm group-hover:scale-105 transition-transform">
              V
            </div>
            <span className="font-display font-bold text-lg text-ink tracking-tight">
              Vanova Hub
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[13.5px] font-medium text-ink-soft">
            <a href="#product" className="hover:text-ink transition-colors">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#businesses" className="hover:text-ink transition-colors">
              For businesses
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors hidden sm:inline"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-full bg-accent text-white text-[13.5px] font-semibold hover:bg-accent-hover active:scale-95 transition-all shadow-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-14 pb-20 lg:pt-20 lg:pb-28 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft text-accent text-[12px] font-mono font-semibold uppercase tracking-wider mb-6">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                Digital Front Desk Operating System
              </div>

              <h1 className="font-display text-[clamp(2.4rem,5vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight text-ink uppercase mb-6">
                YOUR BUSINESS <br />
                HAS A DIGITAL <br />
                <span className="text-accent">FRONT DESK.</span>
              </h1>

              <p className="text-lg text-ink-soft leading-relaxed max-w-xl mb-8">
                Vanova Hub answers customer booking requests, checks your real availability, confirms appointments, and keeps your schedule organized — so you can focus on running your business.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="px-7 py-3.5 rounded-full bg-accent text-white text-base font-semibold hover:bg-accent-hover active:scale-95 transition-all shadow-sm flex items-center gap-2"
                >
                  Get started
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
                <a
                  href="#how-it-works"
                  className="px-7 py-3.5 rounded-full bg-surface border border-line text-ink text-base font-medium hover:bg-surface-neutral transition-all"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* REAL PRODUCT DEMO INTERACTION */}
            <div className="relative">
              <div className="absolute -inset-4 bg-accent/5 rounded-[28px] blur-2xl -z-10" />
              <SelfBookingDemo />
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / AUDIENCE STRIP */}
      <section className="py-10 bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint font-semibold mb-6">
            BUILT FOR BUSINESSES THAT RUN ON APPOINTMENTS
          </p>

          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4">
            {AUDIENCE_TAGS.map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full bg-paper border border-line text-ink text-[13.5px] font-medium shadow-2xs hover:border-accent/40 transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM & WORKFLOW SECTION */}
      <section className="py-20 lg:py-28 bg-surface-neutral/40 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-3xl mb-16">
            <div className="font-mono text-[11px] uppercase tracking-widest text-accent font-semibold mb-3">
              Workflow Transformation
            </div>
            <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-bold text-ink leading-tight tracking-tight uppercase">
              BOOKINGS SHOULDN'T <br />
              INTERRUPT YOUR WORK.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Old Manual Workflow */}
            <div className="p-8 rounded-2xl bg-surface border border-line shadow-xs">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
                <span className="font-mono text-xs uppercase tracking-wider text-error font-semibold">The Old Manual Way</span>
                <span className="text-xs text-ink-faint">Fragmented & Interruptive</span>
              </div>
              <ul className="space-y-4 text-sm text-ink-soft">
                <li className="flex items-start gap-3">
                  <span className="text-error font-bold">✕</span>
                  <span>Customer sends a DM asking for availability</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-error font-bold">✕</span>
                  <span>Owner stops client work to open calendar</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-error font-bold">✕</span>
                  <span>Replies back with 2 potential times</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-error font-bold">✕</span>
                  <span>Waits for client to check their own schedule</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-error font-bold">✕</span>
                  <span>Confirms booking and manually enters appointment</span>
                </li>
              </ul>
            </div>

            {/* Vanova Automated Front Desk */}
            <div className="p-8 rounded-2xl bg-dark-slate text-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-dark-slate-line">
                <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">With Vanova Hub</span>
                <span className="text-xs text-slate-400">Automated & Instant</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">✓</span>
                  <span>Customer asks for a booking time in plain language</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">✓</span>
                  <span>Vanova checks real availability against your working hours</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">✓</span>
                  <span>Appointment gets instantly confirmed and locked</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">✓</span>
                  <span>Dashboard updates live while you stay focused on your work</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT DEMONSTRATION: 3 STEPS */}
      <section id="product" className="py-20 lg:py-28 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.8rem)] font-bold text-ink uppercase tracking-tight mb-4">
              FROM CONVERSATION <br />
              TO CONFIRMED APPOINTMENT.
            </h2>
            <p className="text-ink-soft text-base">
              Customers ask. Vanova answers. Appointments get booked — without manual back and forth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-surface border border-line relative">
              <span className="font-mono text-4xl font-extrabold text-accent/30 block mb-4">01</span>
              <h3 className="font-display text-xl font-bold text-ink mb-2">Customer Asks</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                A client messages your receptionist on your website or chat channel asking for a specific day or service.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-surface border border-line relative">
              <span className="font-mono text-4xl font-extrabold text-accent/30 block mb-4">02</span>
              <h3 className="font-display text-xl font-bold text-ink mb-2">Vanova Checks Availability</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                The digital front desk checks existing bookings, working hours, and buffer times to present exact open slots.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-surface border border-line relative">
              <span className="font-mono text-4xl font-extrabold text-accent/30 block mb-4">03</span>
              <h3 className="font-display text-xl font-bold text-ink mb-2">Appointment Booked</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                The appointment is confirmed, details are saved to your dashboard, and email notifications fire automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI RECEPTIONIST SECTION */}
      <section className="py-20 lg:py-28 bg-dark-slate text-white border-b border-dark-slate-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-accent font-semibold mb-3">
                Intelligent Front Desk
              </div>
              <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-bold uppercase tracking-tight mb-6">
                YOUR DIGITAL FRONT DESK. <br />
                <span className="text-accent">ALWAYS READY.</span>
              </h2>
              <p className="text-slate-300 text-base leading-relaxed mb-6">
                Vanova can answer customer questions, understand appointment requests, check real availability, and complete bookings without requiring the business owner to manually respond to every single request.
              </p>
              <ul className="space-y-3 text-sm text-slate-300 mb-8">
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span>Understands natural human booking requests</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span>Prevents double-bookings automatically</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span>Respects staff availability and business operating hours</span>
                </li>
              </ul>
            </div>

            <div className="bg-surface text-ink p-6 rounded-2xl border border-line shadow-xl">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-line">
                <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center font-bold font-display text-sm">
                  V
                </div>
                <div>
                  <div className="font-bold text-sm text-ink">Vanova Receptionist</div>
                  <div className="text-xs text-ink-faint">Digital Front Desk</div>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div className="bg-surface-neutral p-3 rounded-xl max-w-[85%]">
                  "Hi! Do you have any openings for a haircut tomorrow around 3 PM?"
                </div>
                <div className="bg-accent/10 text-ink p-3 rounded-xl max-w-[85%] ml-auto border border-accent/20">
                  "Hello! Tomorrow we have 2:30 PM and 4:00 PM available for Haircuts. Would 2:30 PM work for you?"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MULTI-CHANNEL SECTION */}
      <section className="py-20 lg:py-28 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.8rem)] font-bold text-ink uppercase tracking-tight mb-4">
              MEET CUSTOMERS <br />
              WHERE THEY ALREADY ARE.
            </h2>
            <p className="text-ink-soft text-base">
              Connect multiple communication channels into one unified booking system.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CHANNELS.map((ch) => (
              <div key={ch.name} className="p-6 rounded-2xl bg-surface border border-line shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-bold text-base text-ink">{ch.name}</span>
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${ch.active ? 'bg-success-bg text-success border border-success-border' : 'bg-surface-neutral text-ink-faint'}`}>
                    {ch.status}
                  </span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">{ch.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRANDED BOOKING WEBSITE SECTION */}
      <section className="py-20 lg:py-28 bg-surface-neutral/30 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-accent font-semibold mb-3">Custom Experience</div>
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.8rem)] font-bold text-ink uppercase tracking-tight mb-4">
              YOUR BOOKING EXPERIENCE. <br />
              YOUR BRAND.
            </h2>
            <p className="text-ink-soft text-base">
              Every business gets its own branded booking page featuring your logo, custom theme colors, service catalog, business hours, and AI chat assistant.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-surface border border-line shadow-sm">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-ink text-white flex items-center justify-center font-bold">
                  G
                </div>
                <div>
                  <h4 className="font-bold text-base text-ink">Glow Hair Studio</h4>
                  <p className="text-xs text-ink-faint">vanovahub.com/glow-salon</p>
                </div>
              </div>
              <span className="px-4 py-1.5 rounded-full bg-accent text-white text-xs font-semibold">
                Book Appointment
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="p-4 rounded-xl bg-surface-neutral">
                <div className="font-bold text-ink mb-1">Hair Styling & Cut</div>
                <div className="text-xs text-ink-soft">45 mins · ₦15,000</div>
              </div>
              <div className="p-4 rounded-xl bg-surface-neutral">
                <div className="font-bold text-ink mb-1">Full Color Treatment</div>
                <div className="text-xs text-ink-soft">90 mins · ₦35,000</div>
              </div>
              <div className="p-4 rounded-xl bg-surface-neutral">
                <div className="font-bold text-ink mb-1">Bridal Consultation</div>
                <div className="text-xs text-ink-soft">60 mins · ₦25,000</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD SECTION */}
      <section className="py-20 lg:py-28 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.8rem)] font-bold text-ink uppercase tracking-tight mb-4">
              EVERY APPOINTMENT. <br />
              ONE PLACE.
            </h2>
            <p className="text-ink-soft text-base">
              A unified operating dashboard giving business owners immediate clarity over today's schedule, next clients, and revenue metrics.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-line shadow-md">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* BUSINESS TYPES */}
      <section id="businesses" className="py-20 lg:py-28 bg-surface-neutral/40 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.8rem)] font-bold text-ink uppercase tracking-tight mb-4">
              BUILT FOR BUSINESSES <br />
              THAT RUN ON APPOINTMENTS.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {BUSINESS_TYPES.map((b) => (
              <div key={b.title} className="p-6 rounded-2xl bg-surface border border-line shadow-2xs hover:border-accent/30 transition-colors">
                <span className="text-3xl mb-3 block">{b.icon}</span>
                <h3 className="font-display font-bold text-base text-ink mb-1">{b.title}</h3>
                <p className="text-xs text-ink-soft leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 lg:py-28 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.8rem)] font-bold text-ink uppercase tracking-tight mb-4">
              HOW IT WORKS.
            </h2>
            <p className="text-ink-soft text-base">Get your digital front desk up and running in minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6">
              <div className="h-12 w-12 rounded-full bg-accent text-white font-mono font-bold text-lg flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="font-display font-bold text-lg text-ink mb-2">Connect Your Business</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Add your services, duration, prices, and working hours in your setup dashboard.
              </p>
            </div>

            <div className="p-6">
              <div className="h-12 w-12 rounded-full bg-accent text-white font-mono font-bold text-lg flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="font-display font-bold text-lg text-ink mb-2">Let Customers Book</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Share your branded booking link or embed your AI receptionist on your website & chat channels.
              </p>
            </div>

            <div className="p-6">
              <div className="h-12 w-12 rounded-full bg-accent text-white font-mono font-bold text-lg flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="font-display font-bold text-lg text-ink mb-2">Run Your Business</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Focus on delivering great service while Vanova handles reservations and sends confirmations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 lg:py-28 bg-surface-neutral/30 border-b border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.8rem)] font-bold text-ink uppercase tracking-tight mb-4">
              ONE SIMPLE SUBSCRIPTION. <br />
              YOUR BOOKINGS, HANDLED.
            </h2>
            <p className="text-ink-soft text-base">
              Transparent platform pricing for your software subscription. Payments collected from your clients go 100% directly to your business.
            </p>
          </div>

          <div className="max-w-md mx-auto p-8 rounded-3xl bg-surface border-2 border-accent shadow-xl relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-mono font-bold uppercase tracking-wider px-4 py-1 rounded-full">
              Vanova Core Subscription
            </div>
            <div className="text-center my-6">
              <span className="font-display text-4xl font-extrabold text-ink">₦15,000</span>
              <span className="text-ink-soft text-sm"> / month</span>
            </div>
            <ul className="space-y-3.5 text-xs text-ink mb-8">
              <li className="flex items-center gap-3">
                <span className="text-accent font-bold">✓</span>
                <span>AI Receptionist on Website & Telegram</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-accent font-bold">✓</span>
                <span>Unlimited appointments & service catalog</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-accent font-bold">✓</span>
                <span>Unified real-time schedule dashboard</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-accent font-bold">✓</span>
                <span>Automatic email confirmations</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-accent font-bold">✓</span>
                <span>Direct client payment collection via Paystack</span>
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full text-center py-3.5 rounded-full bg-accent text-white font-semibold text-sm hover:bg-accent-hover active:scale-95 transition-all shadow-sm"
            >
              Start 14-day free trial
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-dark-slate text-white text-center">
        <div className="max-w-4xl mx-auto px-6 lg:px-10">
          <h2 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold uppercase tracking-tight mb-6">
            READY TO GIVE YOUR <br />
            BUSINESS A <span className="text-accent">DIGITAL FRONT DESK?</span>
          </h2>
          <p className="text-slate-300 text-base max-w-xl mx-auto mb-8">
            Start automating customer booking requests and keeping your schedule organized today.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 rounded-full bg-accent text-white font-semibold text-base hover:bg-accent-hover active:scale-95 transition-all shadow-md"
            >
              Get started
            </Link>
            <Link
              href={`/${DEMO_SLUG}`}
              className="px-8 py-4 rounded-full bg-dark-slate-hover border border-dark-slate-line text-white font-medium text-base hover:bg-slate-800 transition-all"
            >
              See a demo
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 bg-paper border-t border-line text-xs text-ink-faint">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display font-semibold text-ink">
            <div className="h-6 w-6 rounded-lg bg-accent text-white flex items-center justify-center text-xs">V</div>
            <span>Vanova Hub</span>
          </div>
          <div>© {new Date().getFullYear()} Vanova Hub. Digital Front Desk Operating System.</div>
        </div>
      </footer>
    </div>
  );
}
