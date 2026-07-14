// Purely illustrative mockup, fake details throughout, on purpose — this
// card is decoration for the hero, not a data source. Anyone who wants the
// real thing has the actual "See it in action" demo link right next to it.
const FAKE_BUSINESS = 'Maren Studio';

const FAKE_STATS: [number, string][] = [
  [12, 'bookings'],
  [6, 'services'],
  [3, 'team'],
];

const FAKE_BOOKINGS = [
  { name: 'Jamie Rivera', service: 'Cut & Finish' },
  { name: 'Priya Anand', service: 'Colour & Gloss' },
];

export default function HeroTabs() {
  return (
    <div className="bg-surface border border-line rounded-md overflow-hidden shadow-soft">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <div className="h-8 w-8 rounded-full border border-line-strong text-ink flex items-center justify-center font-display text-[13px] shrink-0">
          M
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink truncate">{FAKE_BUSINESS}</p>
          <p className="font-mono text-[10.5px] text-ink-faint">/maren-studio · admin</p>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {FAKE_STATS.map(([value, label]) => (
            <div key={label} className="border border-line rounded-md px-3 py-3 text-center">
              <div className="font-display text-[22px] leading-none">{value}</div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint mt-1.5">
                {label}
              </div>
            </div>
          ))}
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint mb-2">
          Recent bookings
        </p>
        <div className="border border-line rounded-md overflow-hidden">
          {FAKE_BOOKINGS.map((b, i) => (
            <div
              key={b.name}
              className={`flex items-center justify-between px-3.5 py-2.5 ${
                i !== FAKE_BOOKINGS.length - 1 ? 'border-b border-line' : ''
              }`}
            >
              <div>
                <p className="text-[13px] text-ink">{b.name}</p>
                <p className="text-[11px] text-ink-faint mt-0.5">{b.service}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Confirmed
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
