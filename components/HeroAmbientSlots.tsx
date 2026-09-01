// Desktop-only ambient texture behind the (text-only, centered) hero - a
// faint static grid of time-slot-shaped outlines, nothing filled in. The
// earlier version animated a handful of cells to a solid accent fill over
// a couple of seconds ("slots getting booked") - once the stacking-context
// bug that made this invisible was fixed and the fill was actually
// visible, it read as too much orange competing with the CTA buttons
// rather than as atmosphere. Outlines alone still carry the idea (a
// calendar grid, the product's own signature device) without asking for
// any attention. Static now, so this doesn't need 'use client', state, or
// a prefers-reduced-motion check at all - nothing here ever moves.
const COLS = 14;
const ROWS = 7;

export default function HeroAmbientSlots() {
  return (
    <div
      aria-hidden="true"
      // A radial mask keeps this visible only around the text's edges,
      // never behind the actual words or crowding the buttons, so there's
      // no legibility risk to weigh against - it can only ever read as
      // texture.
      className="hidden lg:block absolute inset-0 -z-10 overflow-hidden"
      style={{
        // Pulled the ellipse in (560x340 -> 420x260) - with the fill gone
        // there's no orange left to worry about crowding the text, and the
        // old size was pushing the grid so far out that the whole middle
        // of the hero read as a big empty gap before the pattern showed up
        // at all. Kept the same proportional gap between the two stops
        // (transparent 40% -> black 100%) so the edge still fades in
        // gradually rather than snapping - just over a smaller radius now.
        maskImage: 'radial-gradient(ellipse 420px 260px at center, transparent 40%, black 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 420px 260px at center, transparent 40%, black 100%)',
      }}
    >
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <div
            key={i}
            className="m-[3px] rounded-[4px]"
            style={{ border: '1px solid var(--accent)', opacity: 0.17 }}
          />
        ))}
      </div>
    </div>
  );
}
