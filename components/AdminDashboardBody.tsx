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
  staff?: any;
};

type ExportRow = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  start_time: string;
  status: string;
  service_name: string | null;
};

// One stat inside the Today strip — not its own bordered card. The strip
// itself is the single card; each stat is just a labeled number with a
// hairline divider between them, so three (or four, with Next
// appointment) numbers read as one connected summary of the day instead
// of a row of identical boxes competing for attention.
function TodayStat({
  label,
  value,
  sub,
  color = 'var(--ink)',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-1">{label}</div>
      <div className="font-display text-[24px] font-bold leading-none" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[12px] text-ink-faint mt-1 truncate">{sub}</div>}
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
  todayRevenue,
  thisWeekCount,
  weekCountDelta,
  weekRevenue,
  revenuePctDelta,
  nextSlot,
}: {
  slug: string;
  businessId: string;
  services: { id: string; name: string; duration_minutes: number; price: number | null }[];
  maxAdvanceDays: number;
  exportRows: ExportRow[];
  all: Booking[];
  todayCount: number;
  todayRevenue: number;
  thisWeekCount: number;
  weekCountDelta: number;
  weekRevenue: number;
  revenuePctDelta: number | null;
  nextSlot: Booking | undefined;
}) {
  const [search, setSearch] = useState('');

  // Starts null so the server-rendered markup and the first client render
  // match exactly (a stale server-time "in 45m" badge, or a hydration
  // mismatch) — fills in a tick after mount, then stays current.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const minutesUntilNext =
    nextSlot && now !== null ? Math.round((new Date(nextSlot.start_time).getTime() - now) / 60000) : null;
  const nextSlotLabel =
    nextSlot == null
      ? '—'
      : minutesUntilNext !== null && minutesUntilNext >= 0 && minutesUntilNext <= 180
        ? minutesUntilNext < 60
          ? `In ${Math.max(minutesUntilNext, 1)}m`
          : `In ${Math.floor(minutesUntilNext / 60)}h ${minutesUntilNext % 60}m`
        : new Date(nextSlot.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

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
        <div className="rounded-2xl bg-warm-surface px-5 py-5 mb-8">
          <div className="flex flex-wrap gap-x-8 gap-y-5">
            <TodayStat label="Today" value={String(todayCount)} sub={todayCount === 1 ? 'appointment' : 'appointments'} color="var(--accent)" />
            <TodayStat
              label="Next up"
              value={nextSlotLabel}
              sub={nextSlot ? `${nextSlot.customer_name} · ${(nextSlot as any).services?.name ?? ''}` : 'Nothing scheduled'}
            />
            <TodayStat label="Today's revenue" value={todayRevenue ? `₦${todayRevenue.toLocaleString()}` : '—'} />
            <TodayStat
              label="This week"
              value={String(thisWeekCount)}
              sub={
                weekRevenue
                  ? `₦${weekRevenue.toLocaleString()}${revenuePctDelta ? ` (${revenuePctDelta > 0 ? '+' : ''}${revenuePctDelta}%)` : ''}`
                  : weekCountDelta !== 0
                    ? `${weekCountDelta > 0 ? '+' : ''}${weekCountDelta} vs last week`
                    : undefined
              }
            />
          </div>
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
        <BookingsList slug={slug} bookings={all} search={search} />
      )}
    </div>
  );
}
