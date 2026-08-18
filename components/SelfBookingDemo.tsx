'use client';

import { useEffect, useRef, useState } from 'react';

// The signature moment of the whole landing page: instead of a static
// screenshot of a dashboard, this plays out the actual thing being sold —
// a customer asks a plain question in chat, the AI checks real
// availability, and a booking lands on the dashboard with nobody typing
// "let me check my calendar." Bubble shapes deliberately match
// WebChatWidget's real ones (accent bubble for the customer, paper bubble
// for the assistant) — this is a faithful re-enactment of the product,
// not a separate illustration invented for marketing.
type Step =
  | { kind: 'user'; text: string }
  | { kind: 'thinking' }
  | { kind: 'assistant'; text: string }
  | { kind: 'booked' };

const SCRIPT: Step[] = [
  { kind: 'user', text: 'Hey, are you free tomorrow afternoon?' },
  { kind: 'thinking' },
  { kind: 'assistant', text: "We've got 1:00, 2:30 and 4:00 open tomorrow, which works?" },
  { kind: 'user', text: '2:30 works' },
  { kind: 'thinking' },
  { kind: 'assistant', text: "Great, what's your name?" },
  { kind: 'user', text: 'Amaka' },
  { kind: 'thinking' },
  { kind: 'assistant', text: "You're booked for 2:30 tomorrow, Amaka ✓" },
  { kind: 'booked' },
];

const STEP_DELAY_MS = 900;

export default function SelfBookingDemo() {
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

        SCRIPT.forEach((_, i) => {
          setTimeout(() => setVisibleCount(i + 1), (i + 1) * STEP_DELAY_MS);
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
  const booked = visible.some((s) => s.kind === 'booked');

  return (
    <div ref={containerRef} className="rounded-3xl bg-surface border-2 border-line shadow-[0_20px_50px_-20px_var(--accent-soft)] overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-display text-[14px] font-bold shrink-0" style={{ background: 'var(--accent)' }}>
          G
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink truncate">Glow Salon</p>
          <p className="font-mono text-[10.5px] text-ink-faint">Chat on the booking page</p>
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
          step.kind === 'thinking' ? (
            <div key={i} className="flex justify-start animate-rise">
              <div className="text-white opacity-70 rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-1" style={{ background: 'var(--accent)' }}>
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 rounded-full bg-current opacity-80 animate-pulse" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </div>
            </div>
          ) : step.kind === 'user' ? (
            <div key={i} className="flex justify-end animate-rise">
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] text-ink" style={{ background: 'var(--accent-soft)' }}>
                {step.text}
              </div>
            </div>
          ) : step.kind === 'assistant' ? (
            <div key={i} className="flex justify-start animate-rise">
              <div className="max-w-[80%] text-white rounded-2xl rounded-bl-md px-3.5 py-2 text-[13.5px]" style={{ background: 'var(--accent)' }}>
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
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.08em]" style={{ color: 'var(--accent)' }}>New booking · on the dashboard</p>
                  <p className="text-[13.5px] font-semibold text-ink mt-0.5">Amaka · Haircut · Tomorrow, 2:30 PM</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <div className="px-5 pt-3 border-t border-line">
        <p className="font-mono text-[10px] text-ink-faint mb-3">
          {booked ? 'The business owner never typed a word.' : 'This is the real chat, replaying a real booking.'}
        </p>
        {/* Decorative, not a real input — this card is a replay, not a
            live chat — but the bar itself is drawn to match the actual
            widget's real one exactly, same rounded pill, same send button. */}
        <div className="flex items-center gap-2 rounded-full bg-paper border border-line pl-4 pr-1.5 py-1.5 mb-4">
          <span className="flex-1 text-[13px] text-ink-faint">Type a message…</span>
          <span
            className="h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0"
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
