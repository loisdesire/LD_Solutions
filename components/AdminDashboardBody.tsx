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

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

// Same status→style mapping as BookingsList, reused here rather than
// redefined, so "confirmed" reads identically whether you're looking at
// today's schedule or the full list below it.
const statusStyle: Record<string, string> = {
  confirmed: 'bg-accent-soft text-accent',
  completed: 'bg-ink-wash text-ink-faint',
  cancelled: 'bg-ink-wash text-ink-faint line-through',
  no_show: 'bg-error-bg text-error',
};

// One stat inside the Today strip — not its own bordered card. The strip
// itself is the single card; each stat is just a labeled number with a
// hairline divider between them, so three (or four, with Next
// appointment) numbers read as one connected summary of the day instead
// of a row of identical boxes competing for attention. `emphasis` gives
// "Next up" more visual weight than the other three — it's the one
// number that's actually actionable ("what do I need to do right now"),
// so it shouldn't tie visually with static counts.
function TodayStat({
  label,
  value,
  sub,
  color = 'var(--ink)',
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-1">{label}</div>
      <div
        className={`font-display font-bold leading-none ${emphasis ? 'text-[30px]' : 'text-[24px]'}`}
        style={{ color }}
      >
        {value}
      </div>
      {sub && <div className={`text-[12px] text-ink-faint mt-1 truncate ${emphasis ? 'max-w-[220px]' : ''}`}>{sub}</div>}
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
  todayBookings,
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
  todayBookings: Booking[];
  todayCount: number;
  todayRevenue: number;
  thisWeekCount: number;
  weekCountDelta: number;
  weekRevenue: number;
  revenuePctDelta: number | null;
  nextSlot: Booking | undefined;
}) {
  const [search, setSearch] = useState('');
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
      ? 'No more today'
      : minutesUntilNext !== null && minutesUntilNext >= 0 && minutesUntilNext <= 180
        ? minutesUntilNext < 60
          ? `In ${Math.max(minutesUntilNext, 1)}m`
          : `In ${Math.floor(minutesUntilNext / 60)}h ${minutesUntilNext % 60}m`
        : new Date(nextSlot.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="text-[12px] font-mono text-accent uppercase tracking-widest font-semibold mb-1">
            Digital Front Desk · Live
          </div>
          <h1 className="font-display text-[26px] font-bold text-ink tracking-tight">
            Good morning
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            Here is your schedule breakdown and current front-desk activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-3.5 py-2 w-full md:w-72 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search appointments or customers…"
              className="bg-transparent border-none outline-none text-[13px] text-ink placeholder-ink-faint w-full"
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
      </div>

      {/* Compact Overview Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-line shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-accent" />
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1">Today's Appointments</div>
          <div className="font-display text-[26px] font-bold text-ink">{todayCount}</div>
          <div className="text-[12px] text-ink-soft mt-1 truncate">
            {todayCount > 0 ? `${todayBookings.filter(b => b.status === 'confirmed').length} confirmed` : 'No bookings today'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1">Next Appointment</div>
          <div className="font-display text-[22px] font-bold text-accent truncate">{nextSlotLabel}</div>
          <div className="text-[12px] text-ink-soft mt-1 truncate">
            {nextSlot ? `${nextSlot.customer_name} (${(nextSlot as any).services?.name ?? 'Booking'})` : 'Schedule clear'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1">Today's Revenue</div>
          <div className="font-display text-[26px] font-bold text-ink">
            {todayRevenue ? `₦${todayRevenue.toLocaleString()}` : '₦0'}
          </div>
          <div className="text-[12px] text-ink-soft mt-1">Confirmed earnings</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1">This Week</div>
          <div className="font-display text-[26px] font-bold text-ink">{thisWeekCount}</div>
          <div className="text-[12px] text-ink-soft mt-1 truncate">
            {weekRevenue ? `₦${weekRevenue.toLocaleString()}` : 'Booked appointments'}
          </div>
        </div>
      </div>

      {/* Main Content Layout: Priority Schedule & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* Priority: TODAY'S SCHEDULE */}
        <div className="bg-surface rounded-2xl border border-line p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-line">
            <div>
              <h2 className="font-display text-[18px] font-bold text-ink">Today's Schedule</h2>
              <p className="text-[12.5px] text-ink-soft">Chronological list of all appointments for today</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-accent-soft text-accent text-[12px] font-semibold font-mono">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {todayBookings.length > 0 ? (
            <div className="divide-y divide-line">
              {todayBookings
                .slice()
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map((b) => (
                  <div key={b.id} className="py-4 flex items-center justify-between gap-4 hover:bg-surface-warm/50 transition-colors rounded-lg px-2">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="text-center shrink-0 min-w-[70px]">
                        <span className="font-mono text-[14px] font-bold text-accent block">
                          {new Date(b.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-mono text-ink-faint uppercase">
                          {(b as any).services?.duration_minutes ? `${(b as any).services.duration_minutes}m` : '30m'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[14.5px] text-ink truncate">{b.customer_name}</p>
                        <p className="text-[12.5px] text-ink-soft truncate">
                          {(b as any).services?.name ?? 'Appointment'} · {b.customer_phone || b.customer_email || 'Direct customer'}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider ${statusStyle[b.status] ?? 'bg-surface-neutral text-ink-soft'}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="py-12 text-center border-2 border-dashed border-line rounded-xl bg-surface-warm/30">
              <p className="text-[14px] font-medium text-ink">No appointments scheduled for today</p>
              <p className="text-[12.5px] text-ink-soft mt-1">Your AI receptionist is active and accepting bookings.</p>
            </div>
          )}
        </div>

        {/* Sidebar Column: Upcoming & Quick Links */}
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-line p-5 shadow-sm">
            <h3 className="font-display text-[15px] font-bold text-ink mb-3">All Appointments</h3>
            <p className="text-[12px] text-ink-soft mb-4">Search, filter, or manage all customer bookings.</p>

            {all.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-line rounded-xl">
                <p className="text-[13px] text-ink-soft">No bookings in the system yet.</p>
              </div>
            ) : (
              <BookingsList slug={slug} bookings={all} search={search} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
