'use client';

import { useEffect, useRef, useState } from 'react';

// The owner-side echo of SelfBookingDemo - that one shows a customer
// talking to the AI to book; this shows the business owner talking to the
// SAME kind of assistant to run their business. Deliberately built the
// same way (same bubble shapes, same outcome-card pattern, same reveal
// timing) so the two read as one continuous idea told from both sides,
// not two unrelated demos.
//
// The script matters more than the mechanics here - a first draft that
// just echoed the owner's exact words back ("Add X, 60 min, ₦15,000" ->
// "I'll add X, 60 min, ₦15,000") read as a form with extra steps, which
// is the one thing this is supposed to NOT be. This version has the owner
// type it the way a person actually would (shorthand, "8k" not
// "₦8,000"), and the assistant shows it understood by translating that
// AND by offering a real next step instead of just parroting it back.
type Step =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'saved' };

const SCRIPT: Step[] = [
  { kind: 'user', text: 'Add gel manicures, 45 mins, 8k' },
  { kind: 'assistant', text: 'Got it — Gel Manicure, 45 min, ₦8,000. Want a quick description too, or just save it?' },
  { kind: 'user', text: 'Just save it' },
  { kind: 'assistant', text: "Done! It's live on your booking page 🎉" },
  { kind: 'saved' },
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
  const saved = visible.some((s) => s.kind === 'saved');

  return (
    <div ref={containerRef} className="rounded-3xl bg-surface border-2 border-line shadow-[0_20px_50px_-20px_var(--accent-soft)] overflow-hidden">
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
            <div key={i} className="animate-popIn pt-1">
              <div className="rounded-2xl p-3.5 flex items-center gap-3 border-2" style={{ background: 'var(--cream-surface)', borderColor: 'var(--cream-hover)' }}>
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.08em]" style={{ color: 'var(--accent)' }}>New service · on your booking page</p>
                  <p className="text-[13.5px] font-semibold text-ink mt-0.5">Gel Manicure · 45 min · ₦8,000</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <div className="px-5 pt-3 border-t border-line">
        <p className="font-mono text-[10px] text-ink-faint mb-3">
          {saved ? 'No form. No settings page. Just told it what to do.' : 'Example conversation — see how it works.'}
        </p>
        {/* Decorative, not a real input - matches SelfBookingDemo's own
            fake input bar exactly, same rounded pill, same send button. */}
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
  );
}
