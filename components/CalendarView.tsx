'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PillTabs from './PillTabs';
import Icon from './Icon';
import ConversationPanel from './ConversationPanel';
import { useDialog } from './useDialog';
import { labelClass } from './formStyles';
import { todayInTimezone, dayOfWeekForDate, zonedTimeToUtc } from '@/lib/timezone';

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_telegram_username?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  service_id?: string | null;
  staff_id?: string | null;
  services: any;
  staff: any;
};

type NamedRef = { id: string; name: string };

type Block = {
  id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  reason: string | null;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Every booking on the grid gets a tinted fill by status - the thing the
// Stitch calendar leans on hardest and, confirmed live, "what I love most
// about it." Semantic tokens (success/warning/info/error), never the
// brand accent, so "confirmed" reads green whatever colour a business
// picked for itself. `fill` is a soft wash behind the whole block, `edge`
// a saturated 3px left bar, `text` the time label's colour.
type StatusStyle = { fill: string; edge: string; text: string; label: string };
const STATUS_STYLE: Record<string, StatusStyle> = {
  confirmed: { fill: 'var(--success-bg)', edge: 'var(--success)', text: 'var(--success)', label: 'Confirmed' },
  completed: { fill: 'var(--success-bg)', edge: 'var(--success-border)', text: 'var(--ink-faint)', label: 'Completed' },
  pending_payment: { fill: 'var(--warning-bg)', edge: 'var(--warning)', text: 'var(--warning)', label: 'Awaiting payment' },
  no_show: { fill: 'var(--error-bg)', edge: 'var(--error)', text: 'var(--error)', label: 'No-show' },
  cancelled: { fill: 'var(--ink-wash)', edge: 'var(--line-strong)', text: 'var(--ink-faint)', label: 'Cancelled' },
};
const DEFAULT_STATUS_STYLE: StatusStyle = {
  fill: 'var(--surface)',
  edge: 'var(--line-strong)',
  text: 'var(--ink-soft)',
  label: 'Booked',
};
function statusStyleFor(status: string): StatusStyle {
  return STATUS_STYLE[status] ?? DEFAULT_STATUS_STYLE;
}

// Where a block falls on one specific calendar day, in minutes since that
// day's local midnight, clamped to [0, 1440] - a block can span midnight
// or run several days, so each day it touches gets its own clamped slice
// (or null if it doesn't reach this day at all).
function blockSliceForDay(
  block: Block,
  dayKey: string,
  timezone: string
): { startMin: number; endMin: number } | null {
  const dayStartUtc = zonedTimeToUtc(dayKey, '00:00', timezone).getTime();
  const dayEndUtc = dayStartUtc + 24 * 60 * 60000;
  const bStart = new Date(block.start_time).getTime();
  const bEnd = new Date(block.end_time).getTime();
  if (bEnd <= dayStartUtc || bStart >= dayEndUtc) return null;
  return {
    startMin: Math.max(0, Math.round((bStart - dayStartUtc) / 60000)),
    endMin: Math.min(1440, Math.round((bEnd - dayStartUtc) / 60000)),
  };
}

function formatMinLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${display} ${period}` : `${display}:${String(m).padStart(2, '0')} ${period}`;
}

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
  const s = statusStyleFor(booking.status);

  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-lg border border-line-strong px-2.5 py-2 text-left transition-shadow hover:shadow-lift ${cancelled ? 'opacity-60' : ''}`}
      style={{ background: s.fill, borderLeftColor: s.edge, borderLeftWidth: '3px' }}
    >
      <div className={`font-mono text-label font-semibold ${cancelled ? 'line-through' : ''}`} style={{ color: s.text }}>
        {new Date(booking.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </div>
      <div className={`text-caption font-medium text-ink truncate ${cancelled ? 'line-through' : ''}`}>{booking.customer_name}</div>
      <div className="text-label text-ink-soft truncate">
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
  const s = statusStyleFor(booking.status);

  return (
    <button
      onClick={onOpen}
      className={`absolute rounded-lg border border-l-[3px] px-2 py-1 text-left overflow-hidden transition-shadow hover:z-20 hover:shadow-md ${cancelled ? 'opacity-60' : ''}`}
      style={{
        top: booking._top,
        height: booking._height,
        left: `calc(${booking._left}% + 2px)`,
        width: `calc(${booking._width}% - 4px)`,
        background: s.fill,
        borderColor: s.edge,
        borderLeftColor: s.edge,
      }}
    >
      <div className={`flex items-baseline gap-1.5 min-w-0 ${compact ? '' : 'flex-col items-start gap-0'}`}>
        <span
          className={`font-mono text-[12px] font-semibold shrink-0 ${cancelled ? 'line-through' : ''}`}
          style={{ color: s.text }}
        >
          {new Date(booking.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
        <span className={`text-[13px] font-medium text-ink truncate ${cancelled ? 'line-through' : ''}`}>
          {booking.customer_name}
        </span>
      </div>
      {!compact && (
        <div className="text-[12px] text-ink-soft truncate">
          {serviceName}
          {staffName ? ` · ${staffName}` : ''}
        </div>
      )}
    </button>
  );
}

// Blocked time reads as "not available," visually distinct from any
// booking - a hatched grey fill, no accent anywhere on it. Clicking it
// asks to remove it (the only thing you can do with a block).
const BLOCK_FILL =
  'repeating-linear-gradient(45deg, var(--ink-wash), var(--ink-wash) 6px, transparent 6px, transparent 12px)';

function blockLabel(block: Block, staffName: string | null): string {
  const who = staffName ? `${staffName} out` : 'Blocked';
  return block.reason ? `${who} · ${block.reason}` : who;
}

// Week-view: one row in a day column, same footprint as a booking Chip.
function BlockChip({
  block,
  startMin,
  endMin,
  staffName,
  onRemove,
}: {
  block: Block;
  startMin: number;
  endMin: number;
  staffName: string | null;
  onRemove: () => void;
}) {
  // A block clamped to a full day (a multi-day closure) has no meaningful
  // start/end time to show for this specific day.
  const allDay = startMin === 0 && endMin === 1440;
  return (
    <button
      onClick={onRemove}
      title="Remove this block"
      className="group w-full rounded-xl border border-line-strong px-2.5 py-2 text-left transition-colors hover:border-error"
      style={{ background: BLOCK_FILL }}
    >
      <div className="flex items-center gap-1.5 font-mono text-label font-semibold text-ink-soft">
        <Icon name="event_busy" size={13} className="shrink-0" />
        {allDay ? 'All day' : `${formatMinLabel(startMin)}`}
        <Icon
          name="close"
          size={13}
          className="ml-auto opacity-0 group-hover:opacity-100 text-ink-faint group-hover:text-error transition-opacity"
        />
      </div>
      <div className="text-label text-ink-faint truncate mt-0.5">{blockLabel(block, staffName)}</div>
    </button>
  );
}

// Day-view: absolutely positioned on the time grid like a GridBlock, but
// sitting under real bookings.
function BlockGridBlock({
  block,
  top,
  height,
  staffName,
  onRemove,
}: {
  block: Block;
  top: number;
  height: number;
  staffName: string | null;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onRemove}
      title="Remove this block"
      className="group absolute left-0 right-0 z-0 rounded-lg border border-line-strong px-2 py-1 text-left overflow-hidden hover:border-error transition-colors"
      style={{ top, height, background: BLOCK_FILL }}
    >
      <div className="flex items-center gap-1 font-mono text-[11px] font-semibold text-ink-soft">
        <Icon name="event_busy" size={12} className="shrink-0" />
        <span className="truncate">{blockLabel(block, staffName)}</span>
      </div>
    </button>
  );
}

export default function CalendarView({
  slug,
  timezone,
  bookings,
  staff,
  services,
  blocks,
}: {
  slug: string;
  timezone: string;
  bookings: Booking[];
  staff: NamedRef[];
  services: NamedRef[];
  blocks: Block[];
}) {
  const router = useRouter();
  const today = useMemo(() => todayInTimezone(timezone), [timezone]);
  const [mode, setMode] = useState<'week' | 'day'>('week');
  const [anchor, setAnchor] = useState(today); // a date inside the currently viewed week/day
  const [openConversation, setOpenConversation] = useState<Booking | null>(null);

  // 'all' or a staff/service id. Both narrow what's shown on the grid;
  // the staff filter also narrows blocks (that person's own time off,
  // plus any whole-business block), the service filter doesn't touch
  // them (a block has no service).
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  // Server data is the source of truth (re-fetched via router.refresh
  // after any change), but a local copy lets a just-created or just-
  // removed block show/disappear immediately rather than waiting a
  // round trip.
  const [localBlocks, setLocalBlocks] = useState<Block[]>(blocks);
  useEffect(() => setLocalBlocks(blocks), [blocks]);

  const staffName = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff]);

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

  const filteredBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (staffFilter === 'all' || b.staff_id === staffFilter) &&
          (serviceFilter === 'all' || b.service_id === serviceFilter)
      ),
    [bookings, staffFilter, serviceFilter]
  );

  const visibleBlocks = useMemo(
    () =>
      localBlocks.filter((b) => staffFilter === 'all' || b.staff_id === staffFilter || b.staff_id === null),
    [localBlocks, staffFilter]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filteredBookings) {
      const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(b.start_time));
      const list = map.get(dateKey) ?? [];
      list.push(b);
      map.set(dateKey, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [filteredBookings, timezone]);

  // Blocks that touch a given calendar day, with their clamped slice for
  // that day - keyed the same way byDay is.
  const blocksByDay = useMemo(() => {
    const map = new Map<string, { block: Block; startMin: number; endMin: number }[]>();
    const days = new Set<string>([...weekDays, anchor]);
    for (const day of days) {
      const hits: { block: Block; startMin: number; endMin: number }[] = [];
      for (const block of visibleBlocks) {
        const slice = blockSliceForDay(block, day, timezone);
        if (slice) hits.push({ block, ...slice });
      }
      hits.sort((a, b) => a.startMin - b.startMin);
      if (hits.length) map.set(day, hits);
    }
    return map;
  }, [visibleBlocks, weekDays, anchor, timezone]);

  const filtered = staffFilter !== 'all' || serviceFilter !== 'all';

  // How many bookings fall in whatever is on screen. Counts cancelled ones
  // too, since they are rendered (dimmed and struck through) rather than
  // hidden, so the number matches what is actually visible.
  const visibleDays = useMemo(() => (mode === 'week' ? weekDays : [anchor]), [mode, weekDays, anchor]);
  const rangeCount = visibleDays.reduce((total, day) => total + (byDay.get(day)?.length ?? 0), 0);

  // Legend swatches for exactly the statuses actually on screen right now
  // (and a "Blocked" entry if any block is showing) - so it explains what
  // the colours mean without listing states that aren't in view.
  const legendStatuses = useMemo(() => {
    const seen = new Set<string>();
    for (const day of visibleDays) for (const b of byDay.get(day) ?? []) seen.add(b.status);
    const ordered = ['confirmed', 'pending_payment', 'completed', 'no_show', 'cancelled'].filter((s) => seen.has(s));
    const hasBlocks = visibleDays.some((day) => (blocksByDay.get(day)?.length ?? 0) > 0);
    return { ordered, hasBlocks };
  }, [visibleDays, byDay, blocksByDay]);

  async function removeBlock(id: string) {
    setLocalBlocks((prev) => prev.filter((b) => b.id !== id));
    try {
      await fetch(`/api/calendar/block?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      router.refresh();
    } catch {
      // Put it back if the delete didn't land - the grid shouldn't claim
      // a slot is free when it might not be.
      setLocalBlocks(blocks);
    }
  }

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
  const dayBlocks = useMemo(() => blocksByDay.get(anchor) ?? [], [blocksByDay, anchor]);
  const { rangeStartHour, rangeEndHour } = useMemo(() => {
    let startHour = 8;
    let endHour = 20;
    for (const b of dayBookings) {
      startHour = Math.min(startHour, Math.floor(minutesOfDay(b.start_time, timezone) / 60));
      endHour = Math.max(endHour, Math.ceil(minutesOfDay(b.end_time, timezone) / 60));
    }
    // A block on this day should widen the grid to fit too, so a
    // morning-only block on an otherwise-empty day isn't clipped.
    for (const { startMin, endMin } of dayBlocks) {
      startHour = Math.min(startHour, Math.floor(startMin / 60));
      endHour = Math.max(endHour, Math.ceil(endMin / 60));
    }
    return { rangeStartHour: Math.max(0, startHour), rangeEndHour: Math.min(24, endHour) };
  }, [dayBookings, dayBlocks, timezone]);

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
      {/* md:border-b - the bg-paper/bg-admin-canvas tone swap alone used to
          be enough to read as "a bar sitting above the grid", back when
          the desktop canvas was --warm-surface (close in lightness to
          this bar's own --warm-surface). Since the canvas got a real,
          separate --admin-canvas token, the two are far enough apart in
          hue/lightness that the swap needs an actual edge to still read
          as one, not float free of the grid below it. */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-3 mb-2 bg-transparent border-b border-line flex flex-wrap items-center justify-between gap-3">
        {/* Bordered rounded-md squares, not full circles - the same icon-
            button chrome adopted from the Stitch dashboard for every other
            toolbar action in the admin (see DashboardHeaderActions). */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAnchor((a) => addDays(a, mode === 'week' ? -7 : -1))}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-line bg-surface text-ink-faint hover:bg-warm-surface hover:text-ink transition-all"
            aria-label={mode === 'week' ? 'Previous week' : 'Previous day'}
          >
            <Icon name="chevron_left" size={18} />
          </button>
          <button
            onClick={() => setAnchor(today)}
            disabled={anchor === today}
            className="h-9 px-3.5 rounded-md border text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-default border-line bg-surface text-ink-soft enabled:hover:bg-warm-surface enabled:hover:text-ink"
          >
            Today
          </button>
          <button
            onClick={() => setAnchor((a) => addDays(a, mode === 'week' ? 7 : 1))}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-line bg-surface text-ink-faint hover:bg-warm-surface hover:text-ink transition-all"
            aria-label={mode === 'week' ? 'Next week' : 'Next day'}
          >
            <Icon name="chevron_right" size={18} />
          </button>
          <div className="ml-2">
            <span className="font-display text-[15px] font-semibold text-ink">{rangeLabel}</span>
            <span className="text-caption text-ink-faint ml-2">
              {rangeCount === 0 ? 'nothing booked' : `${rangeCount} booked`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Native selects, styled to sit alongside the bordered icon
              buttons - same reason the rest of the app uses native
              <select> (keyboard, mobile wheel, zero JS). Only shown once
              there's actually more than one option to pick between. */}
          {staff.length > 1 && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              aria-label="Filter by staff"
              className={`h-9 rounded-md border bg-surface pl-3 pr-8 text-[13px] font-medium transition-all appearance-none bg-no-repeat ${
                staffFilter === 'all' ? 'border-line text-ink-soft' : 'border-accent text-accent'
              }`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236e6a63' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundPosition: 'right 0.5rem center',
              }}
            >
              <option value="all">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {services.length > 1 && (
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              aria-label="Filter by service"
              className={`h-9 rounded-md border bg-surface pl-3 pr-8 text-[13px] font-medium transition-all appearance-none bg-no-repeat max-w-[160px] truncate ${
                serviceFilter === 'all' ? 'border-line text-ink-soft' : 'border-accent text-accent'
              }`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236e6a63' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundPosition: 'right 0.5rem center',
              }}
            >
              <option value="all">All services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setBlockModalOpen(true)}
            className="h-9 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-ink-soft hover:bg-warm-surface hover:text-ink transition-all"
          >
            <Icon name="event_busy" size={16} />
            <span className="hidden sm:inline">Block time</span>
          </button>
        </div>
      </div>

      {filtered && (
        <div className="mb-3 flex items-center gap-2 text-caption text-ink-faint">
          <span>
            Showing {staffFilter !== 'all' ? staffName.get(staffFilter) : 'all staff'}
            {serviceFilter !== 'all' ? ` · ${services.find((s) => s.id === serviceFilter)?.name ?? ''}` : ''}
          </span>
          <button
            onClick={() => {
              setStaffFilter('all');
              setServiceFilter('all');
            }}
            className="text-accent hover:underline font-medium"
          >
            Clear
          </button>
        </div>
      )}

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
            const weekDayBlocks = blocksByDay.get(day) ?? [];
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
                  {weekDayBlocks.map(({ block, startMin, endMin }) => (
                    <BlockChip
                      key={block.id}
                      block={block}
                      startMin={startMin}
                      endMin={endMin}
                      staffName={block.staff_id ? staffName.get(block.staff_id) ?? null : null}
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                  {weekDayBookings.length === 0 && weekDayBlocks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-line-strong h-[52px] flex items-center justify-center">
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
          {dayBookings.length === 0 && dayBlocks.length === 0 && (
            <p className="text-body-sm text-ink-faint mb-3">Nothing booked this day - a free day, or one worth filling.</p>
          )}
          {/* True time-grid, not a flat list - hour rows on the left, blocks
              positioned and sized by actual start time and duration on the
              right, laid out side-by-side when two bookings overlap. A flat
              list of chips made a 10:40 and a 1:30 appointment look exactly
              as far apart as a 10:40 and an 11:00, and gave no way to see a
              genuine double-booking versus two that just happen to be
              adjacent. */}
          <div className="flex border border-line rounded-xl bg-surface overflow-hidden">
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

              {/* Blocks sit under bookings (z-wise) - a real appointment
                  that somehow lands on blocked time still needs to be the
                  thing you can see and click. */}
              {dayBlocks.map(({ block, startMin, endMin }) => {
                const top = (startMin - rangeStartHour * 60) * PX_PER_MIN;
                const height = Math.max((endMin - startMin) * PX_PER_MIN, MIN_BLOCK_HEIGHT);
                return (
                  <BlockGridBlock
                    key={block.id}
                    block={block}
                    top={top}
                    height={height}
                    staffName={block.staff_id ? staffName.get(block.staff_id) ?? null : null}
                    onRemove={() => removeBlock(block.id)}
                  />
                );
              })}

              {positionedBookings.map((b) => (
                <GridBlock key={b.id} booking={b} onOpen={() => setOpenConversation(b)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {(legendStatuses.ordered.length > 0 || legendStatuses.hasBlocks) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-label text-ink-faint">
          <span className="font-mono uppercase tracking-[0.08em]">Legend</span>
          {legendStatuses.ordered.map((status) => {
            const s = statusStyleFor(status);
            return (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-[3px] border"
                  style={{ background: s.fill, borderColor: s.edge }}
                />
                {s.label}
              </span>
            );
          })}
          {legendStatuses.hasBlocks && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-[3px] border border-line-strong"
                style={{ background: BLOCK_FILL }}
              />
              Blocked
            </span>
          )}
          <span className="ml-auto tabular-nums">
            {rangeCount === 0
              ? 'nothing booked'
              : `${rangeCount} ${rangeCount === 1 ? 'booking' : 'bookings'} ${
                  mode === 'week' ? 'this week' : anchor === today ? 'today' : 'this day'
                }`}
          </span>
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

      {blockModalOpen && (
        <BlockTimeModal
          slug={slug}
          staff={staff}
          timezone={timezone}
          defaultDate={mode === 'day' ? anchor : today}
          onClose={() => setBlockModalOpen(false)}
          onCreated={(block) => {
            setLocalBlocks((prev) => [...prev, block]);
            setBlockModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// A block is just a start instant, an end instant, and optionally one
// staff member + a short reason. The date and times are entered as the
// business's own wall-clock (the same convention the rest of the admin
// uses) and converted to real UTC instants with zonedTimeToUtc against
// the business timezone - not the browser's - so an owner on a trip, or
// a business in a different timezone from whoever's looking, still blocks
// the hours they actually meant. The API re-validates everything.
function BlockTimeModal({
  slug,
  staff,
  timezone,
  defaultDate,
  onClose,
  onCreated,
}: {
  slug: string;
  staff: NamedRef[];
  timezone: string;
  defaultDate: string;
  onClose: () => void;
  onCreated: (block: Block) => void;
}) {
  const dialogRef = useDialog(true, onClose);
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [staffId, setStaffId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const valid = date && startTime && endTime && startTime < endTime;

  async function submit() {
    if (!valid) return;
    setStatus('saving');
    setErrorMsg('');
    // Business wall-clock -> real UTC instant, against the business's own
    // timezone (see this component's header comment).
    const startISO = zonedTimeToUtc(date, startTime, timezone).toISOString();
    const endISO = zonedTimeToUtc(date, endTime, timezone).toISOString();
    try {
      const res = await fetch('/api/calendar/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, startTime: startISO, endTime: endISO, staffId: staffId || undefined, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Could not save that block.');
        return;
      }
      onCreated(data.block as Block);
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Block time"
      ref={dialogRef}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade"
        style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md bg-surface sm:rounded-2xl border border-line shadow-card p-5 sm:p-6 h-full sm:h-auto overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-[19px] font-semibold text-ink">Block off time</h2>
            <p className="text-caption text-ink-faint mt-0.5">
              Customers won&rsquo;t be able to book over this - a lunch break, a day off, anything.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-ink-faint hover:bg-warm-surface hover:text-ink transition-colors shrink-0"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="block-date">
              Date
            </label>
            <input
              id="block-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="block-start">
                From
              </label>
              <input
                id="block-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="block-end">
                To
              </label>
              <input
                id="block-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>
          </div>
          {!valid && date && (
            <p className="text-caption text-error">The end time needs to be after the start time.</p>
          )}

          {staff.length > 1 && (
            <div>
              <label className={labelClass} htmlFor="block-staff">
                Who&rsquo;s out
              </label>
              <select
                id="block-staff"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
              >
                <option value="">Whole business</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="block-reason">
              Reason <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <input
              id="block-reason"
              type="text"
              value={reason}
              maxLength={120}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lunch, training, public holiday…"
              className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </div>

          {status === 'error' && <p className="text-caption text-error">{errorMsg}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-md border border-line bg-surface text-[13px] font-medium text-ink-soft hover:bg-warm-surface hover:text-ink transition-all"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!valid || status === 'saving'}
              className="h-9 px-4 rounded-md text-[13px] font-semibold text-accent-contrast transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-default"
              style={{ background: 'var(--accent)' }}
            >
              {status === 'saving' ? 'Blocking…' : 'Block this time'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
