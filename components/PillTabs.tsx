// Segmented control - the pill-row tab pattern used for BookingsList's
// scope/status filters and CustomersManager's sort toggle.
//
// Previously a solid-accent-filled pill for the active tab, on a fully
// rounded track - contributed to the site-wide "everything is accent
// orange" overuse the brand direction now explicitly avoids. This is the
// quieter, more contemporary segmented-control pattern instead: a light
// track, and the active option reads as an elevated white chip (shadow,
// not color) rather than a colored fill. Reserves the accent color for
// genuine primary actions elsewhere on the page.
export default function PillTabs<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-warm-surface rounded-lg p-1 flex-wrap">
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            aria-current={isActive ? 'true' : undefined}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all ${
              isActive ? 'bg-surface text-ink shadow-lift' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {opt.label}
            {opt.count != null ? ` ${opt.count}` : ''}
          </button>
        );
      })}
    </div>
  );
}
