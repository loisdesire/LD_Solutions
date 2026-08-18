'use client';

import { useMemo, useState } from 'react';
import PillTabs from './PillTabs';
import { todayInTimezone, dayOfWeekForDate } from '@/lib/timezone';

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  services: any;
  staff: any;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_DOT: Record<string, string> = {
  confirmed: 'var(--accent)',
  completed: 'var(--ink-faint)',
  cancelled: 'var(--ink-faint)',
  no_show: 'var(--error)',
};

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function Chip({ booking }: { booking: Booking }) {
  const staffName = Array.isArray(booking.staff) ? booking.staff[0]?.name : booking.staff?.name;
  const serviceName = Array.isArray(booking.services) ? booking.services[0]?.name : booking.services?.name;
  const cancelled = booking.status === 'cancelled';

  return (
    <div
      className={`rounded-xl border-2 border-line px-2.5 py-2 text-left ${cancelled ? 'opacity-50' : ''}`}
      style={{ borderLeftColor: STATUS_DOT[booking.status] ?? 'var(--line)', borderLeftWidth: '3px' }}
    >
      <div className={`font-mono text-[11px] font-semibold ${cancelled ? 'line-through' : ''}`} style={{ color: 'var(--accent)' }}>
        {new Date(booking.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </div>
      <div className={`text-[12.5px] font-medium truncate ${cancelled ? 'line-through' : ''}`}>{booking.customer_name}</div>
      <div className="text-[11px] text-ink-faint truncate">
        {serviceName}
        {staffName ? ` · ${staffName}` : ''}
      </div>
    </div>
  );
}

export default function CalendarView({
  timezone,
  bookings,
}: {
  timezone: string;
  bookings: Booking[];
}) {
  const today = useMemo(() => todayInTimezone(timezone), [timezone]);
  const [mode, setMode] = useState<'week' | 'day'>('week');
  const [anchor, setAnchor] = useState(today); // a date inside the currently viewed week/day

  const weekStart = useMemo(() => addDays(anchor, -dayOfWeekForDate(anchor)), [anchor]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(b.start_time));
      const list = map.get(dateKey) ?? [];
      list.push(b);
      map.set(dateKey, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [bookings, timezone]);

  const rangeLabel =
    mode === 'week'
      ? `${new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
          addDays(weekStart, 6) + 'T00:00:00'
        ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : new Date(anchor + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchor((a) => addDays(a, mode === 'week' ? -7 : -1))}
            className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-line-strong hover:border-accent hover:text-accent transition-colors"
            aria-label="Previous"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => setAnchor(today)}
            className="px-3.5 py-1.5 rounded-full font-mono text-[11px] text-ink-soft border-2 border-line-strong hover:border-accent hover:text-accent transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setAnchor((a) => addDays(a, mode === 'week' ? 7 : 1))}
            className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-line-strong hover:border-accent hover:text-accent transition-colors"
            aria-label="Next"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <span className="font-display text-[15px] font-semibold text-ink ml-2">{rangeLabel}</span>
        </div>
        <PillTabs
          active={mode}
          onChange={(m) => {
            setMode(m);
            setAnchor((a) => a); // keep the same anchor date when switching modes
          }}
          options={[
            { key: 'week', label: 'Week' },
            { key: 'day', label: 'Day' },
          ]}
        />
      </div>

      {mode === 'week' ? (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {weekDays.map((day, i) => {
            const dayBookings = (byDay.get(day) ?? []).filter((b) => b.status !== 'cancelled');
            const isToday = day === today;
            return (
              <div key={day} className="min-w-0">
                <div
                  className={`flex items-baseline gap-1.5 mb-2 px-1 font-mono text-[11px] uppercase tracking-[0.08em] ${
                    isToday ? 'font-bold' : 'text-ink-faint'
                  }`}
                  style={isToday ? { color: 'var(--accent)' } : undefined}
                >
                  <span>{DAY_LABELS[i]}</span>
                  <span>{Number(day.slice(8, 10))}</span>
                </div>
                <div className="space-y-1.5 min-h-[60px]">
                  {dayBookings.length === 0 ? (
                    <div className="text-[11px] text-ink-faint px-1">—</div>
                  ) : (
                    dayBookings.map((b) => <Chip key={b.id} booking={b} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2 max-w-xl">
          {(byDay.get(anchor) ?? []).length === 0 ? (
            <div className="border-2 border-dashed border-line-strong rounded-2xl py-10 text-center text-[13.5px] text-ink-faint">
              Nothing booked this day.
            </div>
          ) : (
            (byDay.get(anchor) ?? []).map((b) => <Chip key={b.id} booking={b} />)
          )}
        </div>
      )}
    </div>
  );
}
