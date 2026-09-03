'use client';

import { useEffect, useMemo, useState } from 'react';
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

// Minutes since local midnight, in the business's own timezone rather than
// the browser's - two people looking at the same calendar from different
// timezones need to see the same appointment sit at the same visual hour.
function minutesOfDay(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  // Midnight formats as "24:00" in en-GB with hour12:false in some engines -
  // normalize back to 0 rather than let it fall outside a 0-1440 range.
  return (h % 24) * 60 + m;
}

function formatHourLabel(hour: number): string {
  const h = hour % 24;
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${period}`;
}

const HOUR_HEIGHT = 60; // px per hour in the day time-grid
const PX_PER_MIN = HOUR_HEIGHT / 60;
const MIN_BLOCK_HEIGHT = 26; // a 10-minute booking still needs to be readable/tappable

type PositionedBooking = Booking & { _top: number; _height: number; _left: number; _width: number };

// Same overlap-layout approach most calendar UIs use: sweep bookings in
// start order, greedily reuse a column once its previous occupant has
// ended, open a new column otherwise. Bookings that never overlap anything
// get a full-width column of one. This is what actually answers "do I have
// a double-booking here" at a glance - two chips stacked in a plain list
// (the old Day view) look identical whether they're back-to-back or
// genuinely clashing.
function layoutDay(dayBookings: Booking[], rangeStartMin: number, timezone: string): PositionedBooking[] {
  const withTimes = dayBookings
    .map((b) => ({
      booking: b,
      start: minutesOfDay(b.start_time, timezone),
      end: Math.max(minutesOfDay(b.end_time, timezone), minutesOfDay(b.start_time, timezone) + 10),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result: PositionedBooking[] = [];
  let cluster: typeof withTimes = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const colOf = new Map<string, number>();
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => end <= item.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(item.end);
      } else {
        colEnds[col] = item.end;
      }
      colOf.set(item.booking.id, col);
    }
    const colCount = colEnds.length;
    for (const item of cluster) {
      const col = colOf.get(item.booking.id)!;
      result.push({
        ...item.booking,
        _top: (item.start - rangeStartMin) * PX_PER_MIN,
        _height: Math.max((item.end - item.start) * PX_PER_MIN, MIN_BLOCK_HEIGHT),
        _left: (col / colCount) * 100,
        _width: (1 / colCount) * 100,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of withTimes) {
    if (cluster.length && item.start >= clusterEnd) flushCluster();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flushCluster();

  return result;
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

// Absolutely positioned within the grid's relative container, sized to the
// booking's actual duration and offset to its actual start time - see
// `layoutDay` above for how `_left`/`_width` handle two overlapping
// bookings sitting side by side instead of on top of each other.
function GridBlock({ booking, onOpen }: { booking: PositionedBooking; onOpen: () => void }) {
  const staffName = Array.isArray(booking.staff) ? booking.staff[0]?.name : booking.staff?.name;
  const serviceName = Array.isArray(booking.services) ? booking.services[0]?.name : booking.services?.name;
  const cancelled = booking.status === 'cancelled';
  const compact = booking._height < 44;

  return (
    <button
      onClick={onOpen}
      className={`absolute rounded-lg border-2 bg-surface px-2 py-1 text-left overflow-hidden transition-shadow hover:z-20 hover:shadow-md ${cancelled ? 'opacity-50' : ''}`}
      style={{
        top: booking._top,
        height: booking._height,
        left: `calc(${booking._left}% + 2px)`,
        width: `calc(${booking._width}% - 4px)`,
        borderColor: STATUS_DOT[booking.status] ?? 'var(--line)',
      }}
    >
      <div className={`flex items-baseline gap-1.5 min-w-0 ${compact ? '' : 'flex-col items-start gap-0'}`}>
        <span
          className={`font-mono text-[12px] font-semibold shrink-0 ${cancelled ? 'line-through' : ''}`}
          style={{ color: 'var(--accent)' }}
        >
          {new Date(booking.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
        <span className={`text-[13px] font-medium truncate ${cancelled ? 'line-through' : ''}`}>
          {booking.customer_name}
        </span>
      </div>
      {!compact && (
        <div className="text-[12px] text-ink-faint truncate">
          {serviceName}
          {staffName ? ` · ${staffName}` : ''}
        </div>
      )}
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

  // Only for the current-time line in Day view - starts null so server and
  // first client render match, same reasoning as the dashboard's clock.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

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

  // How many bookings fall in whatever is on screen. Counts cancelled ones
  // too, since they are rendered (dimmed and struck through) rather than
  // hidden, so the number matches what is actually visible.
  const rangeCount = (mode === 'week' ? weekDays : [anchor]).reduce(
    (total, day) => total + (byDay.get(day)?.length ?? 0),
    0
  );

  const rangeLabel =
    mode === 'week'
      ? `${new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(
          addDays(weekStart, 6) + 'T00:00:00'
        ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : new Date(anchor + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // Day time-grid range: defaults to a normal 8am-8pm working window, but
  // widens to actually fit anything booked outside it - an early opener or
  // a late appointment shouldn't get silently clipped off the top/bottom
  // of the grid the way the old fixed-height hero section used to clip
  // content (see the public page fix). No business-hours data reaches
  // this component yet, so this is the closest available signal.
  const dayBookings = useMemo(() => byDay.get(anchor) ?? [], [byDay, anchor]);
  const { rangeStartHour, rangeEndHour } = useMemo(() => {
    let startHour = 8;
    let endHour = 20;
    for (const b of dayBookings) {
      startHour = Math.min(startHour, Math.floor(minutesOfDay(b.start_time, timezone) / 60));
      endHour = Math.max(endHour, Math.ceil(minutesOfDay(b.end_time, timezone) / 60));
    }
    return { rangeStartHour: Math.max(0, startHour), rangeEndHour: Math.min(24, endHour) };
  }, [dayBookings, timezone]);

  const hours = useMemo(
    () => Array.from({ length: rangeEndHour - rangeStartHour }, (_, i) => rangeStartHour + i),
    [rangeStartHour, rangeEndHour]
  );
  const gridHeight = hours.length * HOUR_HEIGHT;
  const positionedBookings = useMemo(
    () => layoutDay(dayBookings, rangeStartHour * 60, timezone),
    [dayBookings, rangeStartHour, timezone]
  );
  const nowTop =
    now !== null && anchor === today ? (minutesOfDay(new Date(now).toISOString(), timezone) - rangeStartHour * 60) * PX_PER_MIN : null;

  return (
    <div>
      {/* Sticks to the top of the scroll area. A week of bookings is taller
          than the viewport, so reaching next week meant scrolling back up
          past everything you had just read. The controls stay with you
          instead. Sits under the admin mobile bar, which is z-40. */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-3 mb-2 bg-paper md:bg-warm-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchor((a) => addDays(a, mode === 'week' ? -7 : -1))}
            className="h-10 w-10 flex items-center justify-center rounded-full border-2 border-line-strong hover:border-accent hover:text-accent transition-colors"
            aria-label={mode === 'week' ? 'Previous week' : 'Previous day'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => setAnchor(today)}
            disabled={anchor === today}
            className="px-4 py-2 min-h-[40px] rounded-full font-mono text-label border-2 transition-colors disabled:opacity-40 disabled:cursor-default border-line-strong text-ink-soft enabled:hover:border-accent enabled:hover:text-accent"
          >
            Today
          </button>
          <button
            onClick={() => setAnchor((a) => addDays(a, mode === 'week' ? 7 : 1))}
            className="h-10 w-10 flex items-center justify-center rounded-full border-2 border-line-strong hover:border-accent hover:text-accent transition-colors"
            aria-label={mode === 'week' ? 'Next week' : 'Next day'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <div className="ml-2">
            <span className="font-display text-[15px] font-semibold text-ink">{rangeLabel}</span>
            <span className="text-caption text-ink-faint ml-2">
              {rangeCount === 0 ? 'nothing booked' : `${rangeCount} booked`}
            </span>
          </div>
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
        <>
        {/* A genuinely empty week rendered as "Free" in all seven columns
            reads as broken/placeholder, not "open" - the same information
            Day view already gives as one line ("Nothing booked this day...")
            below. Only shown for a fully empty week; a week with some
            bookings keeps the per-day "Free" cells as-is, where they're
            useful signal about which specific days are open. */}
        {rangeCount === 0 && (
          <p className="text-body-sm text-ink-faint mb-3">Nothing booked this week - wide open, or worth filling.</p>
        )}
        {/* Horizontal scroll below `sm` instead of stacking to one column -
            a vertically-stacked "week" on mobile was just Day view repeated
            seven times, which loses the actual point of a week view (seeing
            the whole week at a glance) rather than serving it worse. The
            partial last column already peeks in as a hint, but it wasn't
            a strong enough cue on its own - the fade edge below makes "more
            days exist, keep scrolling" visible without relying on someone
            noticing a sliver of a column. */}
        <div className="relative">
        <div className="flex sm:grid sm:grid-cols-7 gap-3 overflow-x-auto pb-2 -mx-1 px-1 sm:mx-0 sm:px-0 sm:overflow-visible">
          {weekDays.map((day, i) => {
            // Cancelled bookings are shown (dimmed + struck through), not
            // hidden - Day view already did this; Week view silently
            // dropping them was an inconsistency between the two modes of
            // the same page, not a deliberate choice.
            const weekDayBookings = byDay.get(day) ?? [];
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
                  {weekDayBookings.length > 0 && (
                    <span className="ml-auto tabular-nums" style={{ color: isToday ? 'var(--accent)' : 'var(--ink-faint)' }}>
                      {weekDayBookings.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 min-h-[60px]">
                  {weekDayBookings.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-line h-[52px] flex items-center justify-center">
                      <span className="text-label text-ink-faint">Free</span>
                    </div>
                  ) : (
                    weekDayBookings.map((b) => <Chip key={b.id} booking={b} onOpen={() => setOpenConversation(b)} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Fade hint that more days sit off to the right - mobile only,
            since sm+ already shows all 7 as a grid with nothing to scroll.
            Widened and pushed to full opacity well before the edge (was
            transparent -> paper over the same 32px it covered, so a
            booking's real text sitting right at that edge stayed legible
            but half-cut - reading as clipped/broken, not as "swipe for
            more". Reaching full paper opacity partway through the fade,
            with a wider zone, means nothing readable-but-truncated is ever
            sitting exposed at the edge - just an unambiguous fade. */}
        <div
          className="sm:hidden pointer-events-none absolute top-0 right-0 bottom-2 w-14"
          style={{ background: 'linear-gradient(to right, transparent, var(--paper) 65%)' }}
          aria-hidden="true"
        />
        </div>
        </>
      ) : (
        <div>
          {dayBookings.length === 0 && (
            <p className="text-body-sm text-ink-faint mb-3">Nothing booked this day - a free day, or one worth filling.</p>
          )}
          {/* True time-grid, not a flat list - hour rows on the left, blocks
              positioned and sized by actual start time and duration on the
              right, laid out side-by-side when two bookings overlap. A flat
              list of chips made a 10:40 and a 1:30 appointment look exactly
              as far apart as a 10:40 and an 11:00, and gave no way to see a
              genuine double-booking versus two that just happen to be
              adjacent. */}
          <div className="flex border border-line rounded-2xl bg-surface overflow-hidden">
            <div className="w-12 sm:w-14 shrink-0 border-r border-line" style={{ height: gridHeight }}>
              {hours.map((h, i) => (
                <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                  {i > 0 && (
                    <span className="absolute -top-2 right-2 font-mono text-[10px] text-ink-faint bg-surface px-0.5">
                      {formatHourLabel(h)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex-1 relative" style={{ height: gridHeight }}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className={`absolute left-0 right-0 ${i === 0 ? '' : 'border-t border-line'}`}
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}

              {nowTop !== null && nowTop >= 0 && nowTop <= gridHeight && (
                <div className="absolute left-0 right-0 z-10 flex items-center gap-1" style={{ top: nowTop }}>
                  <span className="h-2 w-2 rounded-full shrink-0 -ml-1" style={{ background: 'var(--accent)' }} />
                  <div className="flex-1 border-t-2" style={{ borderColor: 'var(--accent)' }} />
                </div>
              )}

              {positionedBookings.map((b) => (
                <GridBlock key={b.id} booking={b} onOpen={() => setOpenConversation(b)} />
              ))}
            </div>
          </div>
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
