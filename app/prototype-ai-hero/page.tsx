'use client';

// Throwaway design prototype, not part of the real product - built to
// answer one question live in the actual rendering pipeline (real fonts,
// real Tailwind classes, real per-business accent token system) rather
// than in an external mockup tool guessing at those: what does it look
// like if the ask-bar replaces the weak "Ask AI" button INSIDE the hero
// photo itself, instead of living as a floating corner widget (today) or
// a separate card bolted below the hero (the first attempt at this).
//
// No live data - this route makes no Supabase calls, so it renders the
// same with or without real credentials. Content below is Glow Salon's
// own real copy (name, description, the one visible real service and
// its real price/duration) as seen in a live screenshot of the actual
// site; the accent color is an approximation of the real one (a plain
// hex read off the screenshot, not sampled pixel-exact) since business
// accent colors live in the database, not the codebase.
import { useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { AccentScope } from '@/components/AccentScope';

const BUSINESS = {
  name: 'Glow Salon',
  logo_url: null,
  description: null,
  contact_phone: null,
  contact_email: null,
  instagram_url: null,
  facebook_url: null,
};

const SERVICES = [
  {
    id: 'braiding',
    name: 'Braiding',
    price: 4000,
    duration: '3 hr',
    reply: 'Braiding takes about 3 hours. What day works for you?',
  },
  {
    id: 'haircut',
    name: 'Haircut',
    price: 8000,
    duration: '45 min',
    reply: 'A Haircut takes about 45 minutes. What day works for you?',
  },
  {
    id: 'grooming',
    name: 'Full Grooming',
    price: 12000,
    duration: '75 min',
    reply: 'Full Grooming takes about 75 minutes. What day works for you?',
  },
];

function formatNaira(amount: number) {
  return `₦${new Intl.NumberFormat('en-NG').format(amount)}`;
}

export default function PrototypeAiHero() {
  // Defaults to the first service, not null - showing the card already mid-
  // conversation (like the earlier mockups did) rather than empty, so what
  // renders here demonstrates the actual mechanic instead of a blank box.
  const [selected, setSelected] = useState<(typeof SERVICES)[number] | null>(SERVICES[0]);

  return (
    <AccentScope color="#2563eb" className="min-h-screen bg-paper">
      <SiteHeader slug="glow-salon" business={BUSINESS} active="home" showAbout={false} showGallery={false} showContact={false} />

      {/* Hero: same real fallback treatment app/[slug]/page.tsx uses when a
          business has no cover_image_url - no invented gradient here. */}
      <section className="relative">
        <div className="relative min-h-[62vh] sm:min-h-[74vh]">
          <div className="absolute inset-0 z-0">
            <div
              className="h-full w-full"
              style={{ background: 'linear-gradient(135deg, rgba(18,18,18,0.88), rgba(102,76,61,0.74), rgba(18,18,18,0.82))' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(17,17,17,0.04) 0%, rgba(17,17,17,0.18) 42%, rgba(17,17,17,0.38) 100%)' }}
            />
          </div>

          <div className="relative z-10 flex min-h-[62vh] sm:min-h-[74vh] items-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-6xl mx-auto">
              <div className="max-w-2xl mx-auto text-center">
                <span
                  className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  Open now
                </span>

                <h1 className="font-display text-[40px] font-bold leading-[0.96] tracking-[-0.04em] text-white sm:text-[66px] lg:text-[80px]">
                  {BUSINESS.name}
                </h1>
                <p className="mt-4 max-w-[54ch] mx-auto text-[17px] leading-relaxed text-white/90 sm:text-[19px]">
                  Lagos&rsquo;s go-to for natural hair care and grooming since 2019.
                </p>

                {/* The actual change: this replaces the "Book an appointment" /
                    "Ask AI" button pair. One surface, not two competing ones -
                    real WebChatWidget bubble/input classes, so this looks like
                    the chat that already exists, not a new invented one. */}
                <div className="mt-8 mx-auto max-w-md rounded-[22px] bg-white/97 backdrop-blur-sm shadow-[0_24px_48px_-16px_rgba(0,0,0,0.45)] text-left overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-center gap-2.5 border-b border-line">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
                      style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
                    >
                      G
                    </div>
                    <span className="text-[13.5px] font-semibold text-ink">Ask Glow Salon</span>
                    <span
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      Online
                    </span>
                  </div>

                  {selected && (
                    <div className="px-4 pt-3 space-y-2">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] leading-relaxed text-ink" style={{ background: 'var(--accent-soft)' }}>
                          I&rsquo;d like to book {selected.name}
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-warm-surface px-3.5 py-2 text-[13.5px] leading-relaxed text-ink">
                          {selected.reply}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-3">
                    <div className="flex items-center gap-2.5 rounded-2xl bg-paper border border-line pl-4 pr-2 py-2.5 focus-within:border-[var(--accent)] transition-colors">
                      <input
                        readOnly
                        placeholder="Ask anything, or say what you'd like"
                        className="flex-1 bg-transparent border-none outline-none text-[13.5px] text-ink placeholder-ink-faint"
                      />
                      <button
                        type="button"
                        aria-label="Send"
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <a href="#services" className="mt-4 inline-block text-[13px] text-white/75 hover:text-white underline underline-offset-4">
                  or browse services below
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services - the real BookingForm card markup, including its actual
          no-photo fallback (gradient + icon), since there's no real photo
          URL to reuse here. Tapping one seeds the ask card above, exactly
          like the "tap a service" mechanic already proposed. */}
      <main id="services" className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="mx-auto mb-5 flex max-w-xl items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint shadow-soft">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
            Our services
          </span>
        </div>
        <h2 className="font-display text-[28px] sm:text-[34px] font-semibold text-ink mb-1.5 text-center tracking-[-0.01em]">Or pick one straight away</h2>
        <p className="text-[14.5px] text-ink-faint mb-6 sm:mb-8 text-center">Tapping a service drops it right into the conversation above</p>

        <div className="max-w-5xl mx-auto grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {SERVICES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelected(s);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`group overflow-hidden rounded-[18px] border bg-surface text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_16px_28px_-22px_var(--accent-soft)] ${
                selected?.id === s.id ? 'border-[var(--accent)]' : 'border-line-strong'
              }`}
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent-soft), rgba(255,255,255,0.8))' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 9.5H21" />
                  <path d="M8 3V6.5M16 3V6.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="p-5">
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <h3 className="font-display text-[18px] font-semibold leading-tight text-ink">{s.name}</h3>
                  <span className="shrink-0 rounded-full border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>
                    {formatNaira(s.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="flex shrink-0 items-center gap-1.5 text-ink-faint">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                    <span className="text-[12.5px]">{s.duration}</span>
                  </span>
                  <span className="text-[12.5px] font-medium" style={{ color: 'var(--accent)' }}>
                    Ask about this &rarr;
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      <SiteFooter business={BUSINESS} hoursSummary={null} showContact={false} />
    </AccentScope>
  );
}
