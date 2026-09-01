'use client';

import { useEffect, useState } from 'react';

// Desktop-only ambient texture behind the (now text-only, centered) hero -
// not a repeat of the three failed attempts at a competing content card
// (chat replay, stat card, calendar), all of which were asking to be READ.
// This asks nothing: a faint grid of time slots, a few filling in with the
// accent color over a couple of seconds, the same idea the deleted
// SlotGrid component used ("the page's signature device, grounded in what
// the product actually is... the exact mechanic a calendar goes through
// over a real day"). A radial mask keeps it visible only around the
// text's edges, never behind the actual words, so there's no legibility
// risk to weigh against - it can only ever read as atmosphere.
const COLS = 14;
const ROWS = 7;
const BOOKED = new Set([2, 8, 13, 19, 26, 31, 38, 44, 51, 57, 63, 70, 77, 83, 90]);

export default function HeroAmbientSlots() {
  const [filled, setFilled] = useState<Set<number>>(new Set());

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setFilled(BOOKED);
      return;
    }
    const order = [...BOOKED];
    const timers = order.map((cell, i) =>
      setTimeout(() => setFilled((prev) => new Set(prev).add(cell)), 300 + i * 90)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      aria-hidden="true"
      // Turned back down after actually being visible for the first time -
      // now that the stacking-context bug is fixed (see git history) it
      // was reading as genuinely bright, glow included, competing with the
      // buttons for attention instead of sitting behind them as texture.
      // Opacity roughly halved from that pass, the glow dropped entirely
      // (that was the biggest single source of "too much orange" - it
      // bled accent-colored light beyond each cell's own edges), and the
      // mask's clear zone widened so the grid stays further from the
      // headline/button column instead of crowding right up to it.
      className="hidden lg:block absolute inset-0 -z-10 overflow-hidden"
      style={{
        maskImage: 'radial-gradient(ellipse 620px 380px at center, transparent 55%, black 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 620px 380px at center, transparent 55%, black 100%)',
      }}
    >
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <div
            key={i}
            className="m-[3px] rounded-[4px] transition-all duration-700"
            style={{
              background: filled.has(i) ? 'var(--accent)' : 'transparent',
              border: filled.has(i) ? 'none' : '1px solid var(--accent)',
              opacity: filled.has(i) ? 0.28 : 0.11,
            }}
          />
        ))}
      </div>
    </div>
  );
}
