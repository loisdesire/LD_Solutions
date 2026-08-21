// The pill-row tab pattern used for BookingsList's status filter and
// CustomersManager's sort toggle - same markup was hand-duplicated in
// both places before this. One real, reused pattern, not a speculative
// primitive built ahead of anything using it.
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
    <div className="flex items-center gap-1 bg-paper rounded-full p-1 flex-wrap">
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${
              isActive ? 'text-white' : 'text-ink-faint hover:text-ink'
            }`}
            style={isActive ? { background: 'var(--accent)' } : undefined}
          >
            {opt.label}
            {opt.count != null ? ` ${opt.count}` : ''}
          </button>
        );
      })}
    </div>
  );
}
