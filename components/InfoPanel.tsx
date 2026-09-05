import { formatMoney } from '@/lib/formatMoney';

type Service = { id: string; name: string; duration_minutes: number; price: number | null };

// The secondary column beside ChatHero - "not deleted, not buried": today's
// hours/open-status and the top services a customer would otherwise have
// had to ask the chat for or scroll past the fold to find. Server-rendered,
// plain text - nothing here is interactive, so no ARIA role is needed
// beyond the real heading structure already used.
export default function InfoPanel({
  hoursSummary,
  isOpenNow,
  location,
  popularServices,
  manualFlowHref,
}: {
  hoursSummary: string | null;
  isOpenNow: boolean;
  location: string | null;
  /** Already ordered - top 3 by real booking volume if any bookings exist, otherwise the first 3 configured services. Empty means hide this card entirely, not show it blank. */
  popularServices: Service[];
  manualFlowHref: string;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {hoursSummary && (
        <div className="rounded-2xl bg-warm-surface border border-line px-4 py-3.5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-2.5">Today</h3>
          <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-dashed border-line">
            <span className="text-[13.5px] text-ink-soft">Hours</span>
            {/* Wraps to two lines rather than clipping - hours are exactly
                the kind of information a customer can't afford to have
                cut off. */}
            <span className="text-[13.5px] font-medium text-right">
              {hoursSummary}
              {' · '}
              <span className={isOpenNow ? 'font-semibold' : 'text-ink-faint'} style={isOpenNow ? { color: '#3f8a5c' } : undefined}>
                {isOpenNow ? 'Open now' : 'Closed'}
              </span>
            </span>
          </div>
          {location && (
            <div className="flex justify-between items-baseline gap-3 py-1.5">
              <span className="text-[13.5px] text-ink-soft">Location</span>
              <span className="text-[13.5px] font-medium text-right truncate">{location}</span>
            </div>
          )}
        </div>
      )}

      {popularServices.length > 0 && (
        <div className="rounded-2xl bg-warm-surface border border-line px-4 py-3.5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-2.5">Popular services</h3>
          {popularServices.map((s, i) => (
            <div
              key={s.id}
              className={`flex justify-between items-baseline gap-3 py-1.5 ${i !== popularServices.length - 1 ? 'border-b border-dashed border-line' : ''}`}
            >
              <span className="text-[13.5px] text-ink-soft truncate min-w-0">
                {s.name} · {s.duration_minutes} min
              </span>
              <span className="text-[13.5px] font-medium tabular-nums text-ink-faint shrink-0">
                {s.price != null ? formatMoney(s.price) : 'Ask'}
              </span>
            </div>
          ))}
        </div>
      )}

      <a
        href={manualFlowHref}
        className="flex items-center justify-between gap-3 px-1 py-1.5 text-[13px] text-ink-soft hover:text-ink transition-colors"
      >
        <span>Prefer to browse and book manually?</span>
        <span className="font-semibold shrink-0" style={{ color: 'var(--accent)' }}>
          See full menu →
        </span>
      </a>
    </div>
  );
}
