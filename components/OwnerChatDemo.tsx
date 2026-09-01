'use client';

import { useEffect, useRef, useState } from 'react';

// Shows the business owner talking to the same kind of assistant a
// customer talks to elsewhere on the site to book (WebChatWidget), but
// here to run their business instead - same bubble shapes, same outcome-
// card pattern, so it reads as one continuous idea told from both sides.
//
// The script matters more than the mechanics here - a first draft that
// just echoed the owner's exact words back ("Add X, 60 min, ₦15,000" ->
// "I'll add X, 60 min, ₦15,000") read as a form with extra steps, which
// is the one thing this is supposed to NOT be. This version has the owner
// type it the way a person actually would (shorthand, "8k" not
// "₦8,000"), and the assistant shows it understood by translating that
// AND by offering a real next step instead of just parroting it back.
//
// The final step used to be a generic "Saved" outcome chip - a styled
// checkmark that only ever claimed something changed, the same "trust me"
// gap a plain confirmation sentence has. Switched to an hours example
// specifically so the payoff can be the real settings table itself, with
// the one row that actually changed visibly different from the others -
// that's causality you can see, not a claim in a bubble.
type Step =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'saved' };

const SCRIPT: Step[] = [
  { kind: 'user', text: "We're open till 8 on Fridays now" },
  { kind: 'assistant', text: 'Done — Fridays now close at 8:00 PM.' },
  { kind: 'saved' },
];

const HOURS_PREVIEW = [
  { day: 'Thursday', hours: '9:00 AM – 6:00 PM', changed: false },
  { day: 'Friday', hours: '9:00 AM – 8:00 PM', changed: true },
  { day: 'Saturday', hours: '10:00 AM – 4:00 PM', changed: false },
];

const STEP_DELAY_MS = 900;

export default function OwnerChatDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        if (reduceMotion) {
          setVisibleCount(SCRIPT.length);
          return;
        }

        setVisibleCount(1);
        SCRIPT.slice(1).forEach((_, i) => {
          setTimeout(() => setVisibleCount(i + 2), (i + 1) * STEP_DELAY_MS);
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibleCount]);

  const visible = SCRIPT.slice(0, visibleCount);

  return (
    // Browser-shell frame - traffic-light dots + a URL pill, the actual
    // chat card sitting inside it like a real page in a real browser.
    // Reads as "here's a real screenshot" rather than an illustrated chat
    // bubble floating on the page, which is the same "why does the other
    // one only work because it's black and white" credibility gap a
    // photo-on-a-raw-background hero has without a proper frame.
    <div ref={containerRef} className="rounded-2xl border border-line-strong bg-warm-surface overflow-hidden shadow-[0_20px_50px_-20px_var(--accent-soft)]">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ED6A5E' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F4BF4F' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#61C454' }} />
        </div>
        <div className="flex-1 flex justify-center min-w-0">
          <span className="text-[10.5px] font-mono text-ink-faint bg-surface border border-line rounded-full px-3 py-1 truncate max-w-full">
            vanovahub.com/glow-salon/admin
          </span>
        </div>
        <div className="w-[46px] shrink-0" aria-hidden="true" />
      </div>

      <div className="p-3 sm:p-4">
      <div className="rounded-2xl bg-surface border border-line overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-accent-contrast font-display text-[14px] font-bold shrink-0" style={{ background: 'var(--accent)' }}>
          G
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink truncate">Your business</p>
          <p className="font-mono text-[10.5px] text-ink-faint">Chat on your dashboard</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.06em] shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Online
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-ink-faint shrink-0" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </div>

      <div ref={scrollRef} className="p-5 min-h-[280px] max-h-[280px] overflow-y-auto space-y-2.5">
        {visible.map((step, i) =>
          step.kind === 'user' ? (
            <div key={i} className="flex justify-end animate-rise">
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] text-ink" style={{ background: 'var(--accent-soft)' }}>
                {step.text}
              </div>
            </div>
          ) : step.kind === 'assistant' ? (
            <div key={i} className="flex justify-start animate-rise">
              <div className="max-w-[80%] text-accent-contrast rounded-2xl rounded-bl-md px-3.5 py-2 text-[13.5px]" style={{ background: 'var(--accent)' }}>
                {step.text}
              </div>
            </div>
          ) : (
            // The actual settings table, not a generic "saved" chip - the
            // one row that changed reads visibly differently (accent
            // background, bold) from its two neighbours, so the proof is
            // in the table itself, not a claim about it.
            <div key={i} className="animate-popIn pt-1">
              <div className="rounded-2xl p-3 border-2" style={{ background: 'var(--surface)', borderColor: 'var(--cream-hover)' }}>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] px-1 mb-2" style={{ color: 'var(--accent)' }}>
                  Hours updated · on your booking page
                </p>
                <div className="space-y-1">
                  {HOURS_PREVIEW.map((row) => (
                    <div
                      key={row.day}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] ${row.changed ? 'font-semibold' : 'text-ink-soft'}`}
                      style={row.changed ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
                    >
                      <span>{row.day}</span>
                      <span className="tabular-nums">{row.hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <div className="px-5 pt-4 border-t border-line">
        {/* Decorative, not a real input - same rounded pill and send
            button as WebChatWidget's real one. */}
        <div className="flex items-center gap-2 rounded-full bg-paper border border-line pl-4 pr-1.5 py-1.5 mb-4">
          <span className="flex-1 text-[13px] text-ink-faint">Type a message…</span>
          <span
            className="h-8 w-8 rounded-full flex items-center justify-center text-accent-contrast shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
