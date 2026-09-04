'use client';

import { useEffect, useRef, useState } from 'react';
import { businessTypes } from '@/lib/businessTypes';
import { landingDemoScripts, type ReplayTurn } from '@/lib/landingDemoScripts';

// Scripted, animated replay - deliberately NOT the real, live chat this
// used to be. A genuine visitor found the real widget would accept
// typed input and never respond; rather than debug a live-AI failure
// mode on the single highest-traffic page in the product, this removes
// the failure mode entirely by never calling the real agent here at
// all. Content is real (see lib/landingDemoScripts.ts) - actual example
// conversations for six of the eight verticals already listed further
// down the homepage (lib/businessTypes.tsx) - Massage therapists and
// Music teachers don't have scripts yet, so they're left out of this
// picker rather than shown with nothing to play.
const DELAY_AFTER_MESSAGE_MS = 2200;
const TYPING_MS = 1300;
const LABEL_DELAY_MS = 900;

const scriptedLabels = new Set(landingDemoScripts.map((s) => s.label));
const pickerTypes = businessTypes.filter((b) => scriptedLabels.has(b.label));

type Pill = 'customer' | 'owner';

function TypingBubble() {
  return (
    <div className="flex justify-start animate-rise">
      <div
        className="rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-1"
        style={{ background: 'var(--accent)' }}
        aria-label="Typing"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-white/80 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LandingChatDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const [pill, setPill] = useState<Pill>('customer');
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const script = selected !== null ? landingDemoScripts[selected] : null;
  const side = script ? script[pill] : null;

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // The one place the actual timing sequence is built - both the
  // picker/pill effect below and the "Replay" button call this, rather
  // than keeping two copies of the same timeout chain that could
  // quietly drift apart from each other.
  function play(turns: ReplayTurn[], label: string | undefined) {
    clearTimers();
    setVisibleCount(0);
    setTyping(false);
    setShowLabel(false);
    setDone(false);

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setVisibleCount(turns.length);
      setShowLabel(Boolean(label));
      setDone(true);
      return;
    }

    let elapsed = 0;
    turns.forEach((turn, i) => {
      if (turn.from === 'ai') {
        timers.current.push(
          setTimeout(() => setTyping(true), elapsed),
          setTimeout(() => {
            setTyping(false);
            setVisibleCount(i + 1);
          }, elapsed + TYPING_MS)
        );
        elapsed += TYPING_MS + DELAY_AFTER_MESSAGE_MS;
      } else {
        timers.current.push(setTimeout(() => setVisibleCount(i + 1), elapsed));
        elapsed += DELAY_AFTER_MESSAGE_MS;
      }
    });
    if (label) {
      timers.current.push(setTimeout(() => setShowLabel(true), elapsed + LABEL_DELAY_MS));
      elapsed += LABEL_DELAY_MS;
    }
    timers.current.push(setTimeout(() => setDone(true), elapsed + 200));
  }

  // (Re)starts the replay from scratch whenever the picked vertical or
  // the customer/owner pill changes - a deliberate choice already
  // brought the section into view and into focus, so there's no
  // separate "wait for it to scroll into view" gate the way a passive
  // autoplaying video might need; picking IS the trigger.
  useEffect(() => {
    if (!side) {
      clearTimers();
      setVisibleCount(0);
      setTyping(false);
      setShowLabel(false);
      setDone(false);
      return;
    }
    play(side.turns, side.label);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, pill]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibleCount, typing, showLabel]);

  useEffect(() => clearTimers, []);

  function replay() {
    if (side) play(side.turns, side.label);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* The picker - reuses lib/businessTypes.tsx, the exact same data
          (and so the exact same icons/labels) the "Built for businesses
          that take appointments" section further down the page already
          renders, rather than a second, quietly-driftable copy. */}
      <p className="text-[13px] font-medium text-ink-faint uppercase tracking-[0.08em] mb-3">
        See it for a business like yours
      </p>
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {pickerTypes.map((biz) => {
          const index = landingDemoScripts.findIndex((s) => s.label === biz.label);
          const active = selected === index;
          return (
            <button
              key={biz.label}
              type="button"
              onClick={() => {
                setSelected(index);
                setPill('customer');
              }}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'border-transparent text-accent-contrast'
                  : 'border-line bg-surface text-ink-soft hover:border-accent hover:text-accent'
              }`}
              style={active ? { background: 'var(--accent)' } : undefined}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? 'currentColor' : 'var(--accent)'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
                aria-hidden="true"
              >
                {biz.icon}
              </svg>
              {biz.label}
            </button>
          );
        })}
      </div>

      {!script ? (
        <div className="rounded-3xl border-2 border-dashed border-line bg-warm-surface flex items-center justify-center h-[220px]">
          <p className="text-[14px] text-ink-faint">Pick your business above to see it in action</p>
        </div>
      ) : (
        <>
          {/* The customer/owner pill toggle - a fresh pick above always
              lands back on "customer" first (see onClick), matching the
              order a first-time visitor would actually want to see:
              what their OWN customers experience, before how they'd run
              it themselves. */}
          <div className="flex justify-center gap-2 mb-4">
            {(['customer', 'owner'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPill(p)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                  pill === p ? 'text-accent-contrast' : 'bg-warm-surface text-ink-soft hover:text-ink'
                }`}
                style={pill === p ? { background: 'var(--accent)' } : undefined}
              >
                {p === 'customer' ? 'As the customer' : 'As the business owner'}
              </button>
            ))}
          </div>

          <div className="w-full max-w-md mx-auto rounded-3xl bg-surface border-2 border-line shadow-card flex flex-col h-[460px] overflow-hidden">
            <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-display text-[14px] font-bold text-accent-contrast"
                style={{ background: 'var(--accent)' }}
              >
                {script.businessName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink truncate">{script.businessName}</p>
                <p className="text-[10.5px] text-ink-faint">
                  {pill === 'customer' ? 'What your customers experience' : 'How you run things'}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {side!.turns.slice(0, visibleCount).map((turn, i) => (
                <div key={i} className={`flex animate-rise ${turn.from === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap ${
                      turn.from === 'visitor' ? 'text-ink rounded-br-md' : 'text-accent-contrast rounded-bl-md'
                    }`}
                    style={{ background: turn.from === 'visitor' ? 'var(--accent-soft)' : 'var(--accent)' }}
                  >
                    {turn.text}
                  </div>
                </div>
              ))}
              {typing && <TypingBubble />}
              {showLabel && side!.label && (
                <p className="text-center text-[13px] font-medium text-ink-soft px-2 pt-2 animate-rise">
                  {side!.label}
                </p>
              )}
            </div>

            <div className="shrink-0 border-t border-line p-3 flex items-center justify-center">
              {done ? (
                <button
                  type="button"
                  onClick={replay}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft hover:text-accent transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Replay
                </button>
              ) : (
                <p className="text-[12px] text-ink-faint">A real kind of conversation, both sides — no forms, no dashboards.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
