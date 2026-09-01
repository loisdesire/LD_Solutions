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
      // Was 0.16 opacity accent fill on 0.4-opacity faint-token borders -
      // essentially invisible, which is the actual reason this didn't
      // read as "glam" at all: the code was live and doing exactly what
      // it was told, just too timid to register as a real hero element.
      // Filled cells go a real, visible accent tint now (not a bare hint
      // of one), borders use the accent color too instead of the near-
      // invisible --line token, and the mask's clear zone is smaller so
      // more of the pattern is actually on screen.
      className="hidden lg:block absolute inset-0 -z-10 overflow-hidden"
      style={{
        maskImage: 'radial-gradient(ellipse 480px 300px at center, transparent 50%, black 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 480px 300px at center, transparent 50%, black 100%)',
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
              border: filled.has(i) ? 'none' : '1.5px solid var(--accent)',
              opacity: filled.has(i) ? 0.55 : 0.22,
              boxShadow: filled.has(i) ? '0 4px 14px -4px var(--accent)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}
