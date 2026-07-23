// The tear-line between a ticket's main body and its stub — two notches
// punched out of the edges plus a dashed rule. `notchColor` must match
// whatever sits behind this element (the card it's cutting into), since
// the notches are faked with circles painted in that color, not a real cutout.
export default function TicketPerforation({ notchColor = 'var(--surface)' }: { notchColor?: string }) {
  return (
    <div className="relative py-0" aria-hidden="true">
      <div
        className="absolute -left-3.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
        style={{ background: notchColor }}
      />
      <div
        className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
        style={{ background: notchColor }}
      />
      <div className="border-t-2 border-dashed border-line-strong" />
    </div>
  );
}
