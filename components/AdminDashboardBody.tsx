'use client';

import { useState } from 'react';
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

function StatCard({
  label,
  iconPath,
  value,
  trend,
  color = 'var(--accent)',
}: {
  label: string;
  iconPath: string;
  value: string;
  trend: { value: number; positive: boolean; suffix?: string } | null;
  color?: string;
}) {
  return (
    <div className="rounded-2xl bg-surface border-2 border-line p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-18px_rgba(36,28,24,0.2)]">
      <div className="flex items-start justify-between mb-4">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconPath} />
          </svg>
        </div>
        {trend && (
          <span className={`text-[11.5px] font-medium ${trend.positive ? 'text-accent' : 'text-ink-faint'}`}>
            {trend.positive ? '+' : ''}
            {trend.value}
            {trend.suffix ?? ''} vs last week
          </span>
        )}
      </div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">{label}</div>
      <div className="font-display text-[21px] font-bold leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

export default function AdminDashboardBody({
  slug,
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
        <DashboardHeaderActions slug={slug} rows={exportRows} />
      </div>

      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">Manage</div>
        <h1 className="font-display text-[26px] text-ink">Dashboard</h1>
      </div>

      {all.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Today"
            iconPath="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
            value={String(todayCount)}
            trend={null}
            color="var(--progress)"
          />
          <StatCard
            label="This week"
            iconPath="M9 11H5a2 2 0 00-2 2v6a2 2 0 002 2h4m0-10v10m0-10h6m-6 10h6m0-10h4a2 2 0 012 2v6a2 2 0 01-2 2h-4m0-10v10"
            value={String(thisWeekCount)}
            trend={weekCountDelta === 0 ? null : { value: weekCountDelta, positive: weekCountDelta > 0 }}
            color="var(--tertiary)"
          />
          <StatCard
            label="Week revenue"
            iconPath="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
            value={weekRevenue ? `₦${weekRevenue.toLocaleString()}` : '—'}
            trend={
              revenuePctDelta === null || revenuePctDelta === 0
                ? null
                : { value: revenuePctDelta, positive: revenuePctDelta > 0, suffix: '%' }
            }
            color="var(--accent)"
          />
          <div className="rounded-2xl bg-surface border-2 border-line p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-18px_rgba(36,28,24,0.2)]">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'color-mix(in srgb, var(--progress) 14%, transparent)', color: 'var(--progress)' }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">Next slot</div>
            {nextSlot ? (
              <>
                <div className="font-display text-[19px] leading-tight" style={{ color: 'var(--progress)' }}>
                  {relativeDay(new Date(nextSlot.start_time), startOfToday)}
                </div>
                <div className="text-[13px] font-semibold mt-0.5 text-ink-soft">
                  {new Date(nextSlot.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </div>
                <div className="text-[11px] text-ink-faint mt-1 truncate">
                  {nextSlot.customer_name} · {(nextSlot as any).services?.name}
                </div>
              </>
            ) : (
              <div className="font-display text-[26px] leading-none text-ink-faint">—</div>
            )}
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
