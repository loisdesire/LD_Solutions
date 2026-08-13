'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardHeaderActions from './DashboardHeaderActions';
import BookingsList from './BookingsList';

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_telegram_username: string | null;
  start_time: string;
  status: string;
  services: any;
};

type ExportRow = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  start_time: string;
  status: string;
  service_name: string | null;
};

function relativeDay(date: Date, today: Date): string {
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A trend delta as a status-style pill (dot + text) — the same shape as
// every other status badge in the app (booking status, active/hidden
// toggles) — instead of the plain gray caption text it used to be, so a
// glance at color alone says "good" or "flat" before reading the number.
function TrendPill({ trend }: { trend: { value: number; positive: boolean; suffix?: string } }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${
        trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-ink/5 text-ink-faint'
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {trend.positive ? '+' : ''}
      {trend.value}
      {trend.suffix ?? ''}
    </span>
  );
}

// A quiet 7-bar trend, reusing the exact same day-count data as the
// "Bookings this week" chart below — no extra fetch, just a smaller echo
// of it right where the headline number lives. Today's bar reads full
// strength; the rest sit back so it doesn't compete with the big number.
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-6 mt-2.5" aria-hidden="true">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px] transition-all"
          style={{
            height: `${Math.max((v / max) * 100, v > 0 ? 18 : 8)}%`,
            background: color,
            opacity: v === 0 ? 0.15 : i === data.length - 1 ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// `h-full` + the grid's `auto-rows-fr` (below) is what actually keeps
// these level — every card anchors its icon/trend row at the top and its
// label/value/footer block at the bottom via `mt-auto`, so a card with
// extra footer content (Next slot) grows from the middle instead of
// pushing its bottom edge past the others.
//
// `featured` marks the one metric that matters most at a glance (revenue)
// with a slightly larger number — that alone, not a tinted background too.
// A background wash on top of a bigger font on top of a different border
// color made this one card read as a different *kind* of card sitting
// among three plain white ones, not "the featured metric" — restraint
// means picking one differentiator, not stacking three.
function StatCard({
  label,
  icon,
  value,
  trend,
  badge,
  color = 'var(--accent)',
  footer,
  featured = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  trend: { value: number; positive: boolean; suffix?: string } | null;
  badge?: React.ReactNode;
  color?: string;
  footer?: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div className="h-full flex flex-col rounded-2xl bg-surface border-2 border-line p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-18px_rgba(36,28,24,0.2)]">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div
          className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </div>
        <div className="shrink-0 whitespace-nowrap">{trend ? <TrendPill trend={trend} /> : badge}</div>
      </div>
      <div className="mt-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">{label}</div>
        <div className={`font-display font-bold leading-none ${featured ? 'text-[26px]' : 'text-[21px]'}`} style={{ color }}>
          {value}
        </div>
        {footer}
      </div>
    </div>
  );
}

export default function AdminDashboardBody({
  slug,
  businessId,
  services,
  maxAdvanceDays,
  exportRows,
  all,
  todayCount,
  thisWeekCount,
  weekCountDelta,
  weekRevenue,
  revenuePctDelta,
  nextSlot,
  startOfToday,
  last7Days,
  dayCounts,
  maxDayCount,
  lowStock,
}: {
  slug: string;
  businessId: string;
  services: { id: string; name: string; duration_minutes: number; price: number | null }[];
  maxAdvanceDays: number;
  exportRows: ExportRow[];
  all: Booking[];
  todayCount: number;
  thisWeekCount: number;
  weekCountDelta: number;
  weekRevenue: number;
  revenuePctDelta: number | null;
  nextSlot: Booking | undefined;
  startOfToday: Date;
  last7Days: Date[];
  dayCounts: number[];
  maxDayCount: number;
  lowStock: { id: string; name: string; stock_quantity: number | null }[];
}) {
  const [search, setSearch] = useState('');

  // Starts null so the server-rendered markup and the first client render
  // match exactly (no "in 45m" badge either has a stale server-time value
  // baked in or causes a hydration mismatch) — it fills in a tick after
  // mount, then keeps itself current every minute while the page is open.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const minutesUntilNext =
    nextSlot && now !== null ? Math.round((new Date(nextSlot.start_time).getTime() - now) / 60000) : null;
  const nextSlotSoon = minutesUntilNext !== null && minutesUntilNext >= 0 && minutesUntilNext <= 180;

  // Same dayCounts array that draws Today's sparkline — last index is
  // today, the one before it is yesterday — so this is a real delta, not
  // a filler number, and it's what gives Today a badge in the first
  // place: without one, it was the only card of the four with an empty
  // top-right slot, which is what actually broke the row's rhythm.
  const todayDelta = dayCounts.length >= 2 ? todayCount - dayCounts[dayCounts.length - 2] : 0;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-surface border-2 border-line rounded-full px-4 py-2.5 w-full sm:w-96 transition-colors focus-within:border-[var(--accent)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients or bookings…"
            className="bg-transparent border-none outline-none text-[13.5px] text-ink placeholder-ink-faint w-full"
          />
        </div>
        <DashboardHeaderActions
          slug={slug}
          rows={exportRows}
          businessId={businessId}
          services={services}
          maxAdvanceDays={maxAdvanceDays}
        />
      </div>

      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">Manage</div>
        <h1 className="font-display text-[26px] text-ink">Dashboard</h1>
      </div>

      {all.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 auto-rows-fr">
          <StatCard
            label="Today"
            icon={<path d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />}
            value={String(todayCount)}
            trend={todayDelta === 0 ? null : { value: todayDelta, positive: todayDelta > 0 }}
            color="var(--progress)"
            footer={<MiniSparkline data={dayCounts} color="var(--progress)" />}
          />
          <StatCard
            label="This week"
            icon={<path d="M9 11H5a2 2 0 00-2 2v6a2 2 0 002 2h4m0-10v10m0-10h6m-6 10h6m0-10h4a2 2 0 012 2v6a2 2 0 01-2 2h-4m0-10v10" />}
            value={String(thisWeekCount)}
            trend={weekCountDelta === 0 ? null : { value: weekCountDelta, positive: weekCountDelta > 0 }}
            color="var(--tertiary)"
          />
          <StatCard
            label="Week revenue"
            icon={<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />}
            value={weekRevenue ? `₦${weekRevenue.toLocaleString()}` : '—'}
            trend={
              revenuePctDelta === null || revenuePctDelta === 0
                ? null
                : { value: revenuePctDelta, positive: revenuePctDelta > 0, suffix: '%' }
            }
            color="var(--accent)"
            featured
          />
          <StatCard
            label="Next slot"
            icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
            // The time itself is the number someone actually scans for here
            // — "Tomorrow" alone wasn't a useful headline. Day + customer
            // move down into the subtext line, same weight as every other
            // card's supporting context instead of competing with it.
            value={nextSlot ? new Date(nextSlot.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'}
            trend={null}
            color="var(--progress)"
            badge={
              nextSlotSoon ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em]"
                  style={{ background: 'color-mix(in srgb, var(--progress) 14%, transparent)', color: 'var(--progress)' }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current animate-pulse" />
                  {minutesUntilNext! < 60 ? `${Math.max(minutesUntilNext!, 1)}m` : `${Math.floor(minutesUntilNext! / 60)}h ${minutesUntilNext! % 60}m`}
                </span>
              ) : undefined
            }
            footer={
              nextSlot && (
                <div className="text-[11px] text-ink-faint mt-1.5 truncate">
                  {relativeDay(new Date(nextSlot.start_time), startOfToday)} · {nextSlot.customer_name} ({(nextSlot as any).services?.name})
                </div>
              )
            }
          />
        </div>
      )}

      {all.length === 0 ? (
        <div className="border-2 border-dashed border-line-strong rounded-3xl p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-display text-[20px]">No bookings yet — that's normal</h2>
          <p className="text-ink-soft text-[13.5px] mt-1.5 max-w-sm mx-auto">
            The moment someone books through your page, they'll show up right here with all their
            details.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href={`/${slug}/admin/services`}
              className="rounded-md border border-line-strong px-4 py-2 text-[13.5px] font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Add a service
            </Link>
            <Link
              href={`/${slug}/admin/hours`}
              className="rounded-md border border-line-strong px-4 py-2 text-[13.5px] font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Set your hours
            </Link>
          </div>
          <div className="font-mono text-[10.5px] text-ink-faint mt-6 tracking-[0.05em]">/{slug}</div>
        </div>
      ) : (
        <>
          <BookingsList slug={slug} bookings={all} search={search} />

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 rounded-2xl bg-surface border-2 border-line p-5">
              <h3 className="font-display text-[17px] font-semibold text-ink mb-5">Bookings this week</h3>
              <div className="h-48 flex items-end justify-between gap-2 px-1">
                {last7Days.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end h-40">
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max((dayCounts[i] / maxDayCount) * 100, dayCounts[i] > 0 ? 8 : 2)}%`,
                          background: dayCounts[i] > 0 ? 'var(--accent)' : 'var(--line)',
                          opacity: dayCounts[i] > 0 ? 1 : 0.4,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-ink-faint">
                      {new Date(day).toLocaleDateString(undefined, { weekday: 'short' })[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {lowStock.length > 0 && (
              <div className="lg:col-span-4 rounded-2xl p-5" style={{ background: 'var(--accent-soft)' }}>
                <p className="font-semibold text-[14px] text-ink mb-2">Low stock</p>
                <div className="space-y-1.5">
                  {lowStock.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-ink-soft truncate">{p.name}</span>
                      <span className="font-mono font-semibold shrink-0 ml-2" style={{ color: 'var(--accent)' }}>
                        {p.stock_quantity} left
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/${slug}/admin/products`}
                  className="inline-block mt-3 text-[12.5px] font-semibold hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Manage products →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
