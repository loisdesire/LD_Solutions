'use client';

import { useEffect, useState } from 'react';

// The page's signature device, grounded in what the product actually is
// rather than a generic AI-startup visual (no sparkles, no gradient
// orbs): a grid of time slots, mostly empty, a handful filling in with
// the accent color - the exact mechanic a calendar goes through over a
// real day. Purely ambient background texture behind the hero's two-
// column content, not a decoration invented independently of the brief.
//
// A fixed, hand-picked set of "booked" cells (not random per render) -
// random placement would look different on every reload/hydration and
// risks a server/client mismatch; this way it's the same considered
// pattern every time, like a real design choice rather than noise.
const COLS = 16;
const ROWS = 6;
const BOOKED = new Set([3, 9, 14, 22, 27, 35, 41, 48, 55, 61, 68, 74, 81, 89]);

export default function SlotGrid({ className = '' }: { className?: string }) {
  const [filled, setFilled] = useState<Set<number>>(new Set());

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setFilled(BOOKED);
      return;
    }
    // Fills in over ~2s, once, on mount - "the day filling up," not a
    // loop. Mirrors the pacing of the booking conversation replaying in
    // SelfBookingDemo right next to it, so the whole hero reads as one
    // moment rather than two separate animations running independently.
    const order = [...BOOKED];
    order.forEach((cell, i) => {
      setTimeout(() => setFilled((prev) => new Set(prev).add(cell)), 300 + i * 130);
    });
  }, []);

  const cells = Array.from({ length: COLS * ROWS }, (_, i) => i);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none grid gap-[10px] ${className}`}
      style={{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        maskImage: 'radial-gradient(ellipse 85% 85% at 50% 40%, black 35%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 40%, black 35%, transparent 78%)',
      }}
    >
      {cells.map((i) => {
        const isFilled = filled.has(i);
        return (
          <span
            key={i}
            className="aspect-square rounded-[3px] transition-colors duration-700"
            style={{ background: isFilled ? 'var(--accent)' : 'var(--line)', opacity: isFilled ? 0.55 : 0.5 }}
          />
        );
      })}
    </div>
  );
}
