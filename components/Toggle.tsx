'use client';

// One switch, previously copy-pasted into SettingsManager and
// SiteContentManager and already drifted apart between them.
//
// The track was a <span>, which is display:inline and therefore ignores
// width and height. It only had a size at all because it happened to be a
// flex child; anywhere else it would have collapsed. The knob was
// absolutely positioned with a `top` but no `left`, relying on its static
// position, which is fragile. Both are explicit now.
//
// role="switch" with aria-checked is what actually tells a screen reader
// this is an on/off control. aria-pressed on a plain button announces it
// as a toggle button, which is close but not the same thing.
export default function Toggle({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2.5 shrink-0 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          on ? 'bg-accent' : 'bg-line-strong'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="text-caption font-medium text-ink-soft">{on ? `${label} on` : `${label} off`}</span>
    </button>
  );
}
