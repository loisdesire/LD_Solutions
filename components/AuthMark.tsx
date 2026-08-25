// Every auth screen's desktop half carries a branded left panel; on mobile
// that panel disappears entirely (`hidden lg:flex`), leaving nothing but a
// floating, unbranded form on a blank background - no logo, no business
// name, no sense of whose login screen this even is. This is the mobile
// substitute: small, but present at every width the desktop panel isn't.
export default function AuthMark({
  name,
  label,
  logoUrl,
}: {
  name: string;
  label: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-7">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover shrink-0" />
      ) : (
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center text-accent-contrast font-display text-[14px] font-semibold shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          {name?.[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-display text-[15px] font-semibold text-ink truncate">{name}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</div>
      </div>
    </div>
  );
}
