'use client';

import { useMemo, useState } from 'react';
import PillTabs from './PillTabs';
import ConversationPanel from './ConversationPanel';
import { todayInTimezone, dayOfWeekForDate } from '@/lib/timezone';

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_telegram_username?: string | null;
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

// A button, not a static card - every other list in the app (BookingsList,
// CustomersManager) makes a booking's contact clickable to open the same
// conversation panel; the calendar was the one place that broke that
// pattern and just showed a read-only summary.
function Chip({ booking, onOpen }: { booking: Booking; onOpen: () => void }) {
  const staffName = Array.isArray(booking.staff) ? booking.staff[0]?.name : booking.staff?.name;
  const serviceName = Array.isArray(booking.services) ? booking.services[0]?.name : booking.services?.name;
  const cancelled = booking.status === 'cancelled';

  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-xl border-2 border-line px-2.5 py-2 text-left transition-colors hover:border-accent ${cancelled ? 'opacity-50' : ''}`}
      style={{ borderLeftColor: STATUS_DOT[booking.status] ?? 'var(--line)', borderLeftWidth: '3px' }}
    >
      <div className={`font-mono text-label font-semibold ${cancelled ? 'line-through' : ''}`} style={{ color: 'var(--accent)' }}>
        {new Date(booking.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </div>
      <div className={`text-caption font-medium truncate ${cancelled ? 'line-through' : ''}`}>{booking.customer_name}</div>
      <div className="text-label text-ink-faint truncate">
        {serviceName}
        {staffName ? ` · ${staffName}` : ''}
      </div>
    </button>
  );
}

export default function CalendarView({
  slug,
  timezone,
  bookings,
}: {
  slug: string;
  timezone: string;
  bookings: Booking[];
}) {
  const today = useMemo(() => todayInTimezone(timezone), [timezone]);
  const [mode, setMode] = useState<'week' | 'day'>('week');
  const [anchor, setAnchor] = useState(today); // a date inside the currently viewed week/day
  const [openConversation, setOpenConversation] = useState<Booking | null>(null);

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
      ? `${new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(
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
            className="px-3.5 py-1.5 rounded-full font-mono text-label text-ink-soft border-2 border-line-strong hover:border-accent hover:text-accent transition-colors"
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
        // Horizontal scroll below `sm` instead of stacking to one column -
        // a vertically-stacked "week" on mobile was just Day view repeated
        // seven times, which loses the actual point of a week view (seeing
        // the whole week at a glance) rather than serving it worse.
        <div className="flex sm:grid sm:grid-cols-7 gap-3 overflow-x-auto pb-2 -mx-1 px-1 sm:mx-0 sm:px-0 sm:overflow-visible">
          {weekDays.map((day, i) => {
            // Cancelled bookings are shown (dimmed + struck through), not
            // hidden - Day view already did this; Week view silently
            // dropping them was an inconsistency between the two modes of
            // the same page, not a deliberate choice.
            const dayBookings = byDay.get(day) ?? [];
            const isToday = day === today;
            return (
              <div
                key={day}
                className={`min-w-[150px] sm:min-w-0 shrink-0 sm:shrink rounded-xl -mx-1 px-1 pt-1 pb-2 ${isToday ? 'bg-accent-soft' : ''}`}
              >
                <div
                  className={`flex items-baseline gap-1.5 mb-2 px-1 font-mono text-label uppercase tracking-[0.08em] ${
                    isToday ? 'font-bold' : 'text-ink-faint'
                  }`}
                  style={isToday ? { color: 'var(--accent)' } : undefined}
                >
                  <span>{DAY_LABELS[i]}</span>
                  <span>{Number(day.slice(8, 10))}</span>
                </div>
                <div className="space-y-1.5 min-h-[60px]">
                  {dayBookings.length === 0 ? (
                    <div className="text-label text-ink-faint px-1">-</div>
                  ) : (
                    dayBookings.map((b) => <Chip key={b.id} booking={b} onOpen={() => setOpenConversation(b)} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2 max-w-xl">
          {(byDay.get(anchor) ?? []).length === 0 ? (
            <div className="border-2 border-dashed border-line-strong rounded-2xl py-10 text-center text-body-sm text-ink-faint">
              Nothing booked this day - a free day, or one worth filling.
            </div>
          ) : (
            (byDay.get(anchor) ?? []).map((b) => <Chip key={b.id} booking={b} onOpen={() => setOpenConversation(b)} />)
          )}
        </div>
      )}

      {openConversation && (
        <ConversationPanel
          slug={slug}
          customerPhone={openConversation.customer_phone}
          customerLabel={
            openConversation.customer_telegram_username
              ? `@${openConversation.customer_telegram_username}`
              : openConversation.customer_name
          }
          onClose={() => setOpenConversation(null)}
        />
      )}
    </div>
  );
}
