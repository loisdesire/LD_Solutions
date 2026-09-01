'use client';

// A native <select>, not a custom-built picker - this is the whole
// component. On iOS Safari a native select IS a scroll-wheel strip; on
// Android/Chrome it's the OS's own compact list; on desktop it's a plain
// dropdown. All three are exactly "a compact closed control that opens
// something you scroll/pick from," and the platform already handles
// every hard part correctly for free: it's compact until tapped, it
// genuinely blocks the page behind it while open (native OS UI, not
// something built out of z-index and a backdrop div), and it's
// accessible by keyboard and screen reader with zero extra code. Two
// custom rebuilds of this (an inline hour/minute grid, then a hand-
// rolled scroll-wheel popup) were both trying to reinvent what a select
// already does - this replaces both.
//
// Options are grouped by time of day only for readability on a long
// list - real content, same as this file's own first version. What
// actually read as "dumping" before was rendering every slot as its own
// always-visible tap target on the page; grouped options inside a closed
// native control never has that problem, since nothing is on screen
// until it's opened.
type Period = 'Morning' | 'Afternoon' | 'Evening';

function groupByPeriod(slots: string[]): [Period, string[]][] {
  const order: Period[] = ['Morning', 'Afternoon', 'Evening'];
  const groups: Record<Period, string[]> = { Morning: [], Afternoon: [], Evening: [] };
  for (const s of slots) {
    const h = new Date(s).getHours();
    const period: Period = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    groups[period].push(s);
  }
  return order.filter((p) => groups[p].length > 0).map((p) => [p, groups[p]]);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function SlotTimePicker({
  slots,
  selectedSlot,
  onSelect,
}: {
  slots: string[];
  selectedSlot: string;
  onSelect: (iso: string) => void;
}) {
  const periods = groupByPeriod(slots);

  return (
    <div className="relative">
      <select
        value={selectedSlot}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Select a time"
        style={
          selectedSlot
            ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)' }
            : { borderColor: 'var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)' }
        }
        className="w-full appearance-none rounded-xl border-2 pl-11 pr-10 py-3 text-[14px] font-semibold outline-none transition-colors cursor-pointer focus:border-[var(--accent)]"
      >
        <option value="" disabled>
          Select a time
        </option>
        {periods.map(([period, times]) => (
          <optgroup key={period} label={period}>
            {times.map((t) => (
              <option key={t} value={t}>
                {formatTime(t)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Decorative - the real control is the native select sitting on
          top of these (appearance-none above drops the OS's own arrow so
          it doesn't double up with the chevron here). */}
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
        style={{ color: selectedSlot ? 'var(--accent)' : 'var(--ink-faint)' }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" strokeLinecap="round" />
      </svg>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
        style={{ color: selectedSlot ? 'var(--accent)' : 'var(--ink-faint)' }}
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
