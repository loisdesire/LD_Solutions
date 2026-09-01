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
        // A wider gap between the two stops (40%->100%, was 55%->100% on a
        // smaller ellipse) spreads the fade over more distance instead of
        // snapping from fully clear to fully visible in a short span -
        // that tight transition was reading as a glowing ring around the
        // text rather than a soft edge.
        maskImage: 'radial-gradient(ellipse 560px 340px at center, transparent 40%, black 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 560px 340px at center, transparent 40%, black 100%)',
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
            style={{ border: '1px solid var(--accent)', opacity: 0.11 }}
          />
        ))}
      </div>
    </div>
  );
}
