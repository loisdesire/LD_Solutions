'use client';

import { useState, useMemo, useEffect, useRef } from 'react';

type CalendarPickerProps = {
  selectedDate: string; // YYYY-MM-DD
  onChange: (d: Date) => void;
  today: string; // YYYY-MM-DD
  maxDate: string; // YYYY-MM-DD
  // Optional on purpose - a caller with no service picked yet (there
  // isn't one until step 1 of the booking flow is done) just gets the
  // calendar with no per-day signal, same as before this existed.
  businessId?: string;
  serviceId?: string;
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

export default function CalendarPicker({
  selectedDate,
  onChange,
  today,
  maxDate,
  businessId,
  serviceId,
}: CalendarPickerProps) {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  // date string -> has any open slot. Missing key = unknown yet (still
  // loading, or out of the bookable range) - deliberately NOT treated as
  // "no availability" so a date never flashes muted before the real
  // answer comes back.
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  const initialDate = useMemo(() => {
    if (!selectedDate) return new Date();
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const [weekStart, setWeekStart] = useState<Date>(initialDate);
  const [monthCursor, setMonthCursor] = useState<Date>(initialDate);

  // Every day cell was a bare number with no aria-label - a screen reader
  // just announced "15", with no month, weekday, or availability context.
  // Arrow-key movement between cells didn't exist either: the only way to
  // reach day 28 was to Tab through every disabled and enabled cell ahead
  // of it. focusedDate drives a roving tabindex (one cell in the tab
  // order at a time, matching the standard date-grid keyboard pattern)
  // and is where arrow-key navigation below moves the "current" cell.
  const [focusedDate, setFocusedDate] = useState<string>(selectedDate || today);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Only true right after an arrow key changed focusedDate - clicking a
  // date, or selectedDate changing because a service/step changed
  // upstream, must NOT steal focus into the calendar.
  const pendingFocusRef = useRef(false);

  useEffect(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const newD = new Date(y, m - 1, d);
      setWeekStart(newD);
      setMonthCursor(newD);
      setFocusedDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const btn = btnRefs.current[focusedDate];
    if (btn) {
      btn.focus();
      pendingFocusRef.current = false;
    }
    // If the button isn't mounted yet (a view shift is still catching up
    // to a focus move that landed outside the previously visible range),
    // the flag stays set and the next render's pass picks it up.
  });

  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  const monthDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const startOfGrid = new Date(firstDay);
    startOfGrid.setDate(firstDay.getDate() - startDayOfWeek);
    return Array.from({ length: 42 }, (_, i) => addDays(startOfGrid, i));
  }, [monthCursor]);

  function pickDate(d: Date) {
    const ds = toDateStr(d);
    if (ds < today || ds > maxDate) return;
    onChange(d);
  }

  // Prev/Next never disabled at the edges of the bookable range - paging
  // past it landed on a week/month with zero selectable days and no
  // signal why. Same day/month-index comparison the rest of this file
  // already uses (toDateStr, getMonth/getFullYear), just applied to the
  // nav buttons instead of individual cells.
  const [todayY, todayM, todayD] = today.split('-').map(Number);
  const todayDate = new Date(todayY, todayM - 1, todayD);
  const [maxY, maxM, maxD] = maxDate.split('-').map(Number);
  const maxDateObj = new Date(maxY, maxM - 1, maxD);
  const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

  const prevDisabled =
    viewMode === 'week'
      ? toDateStr(weekDays[0]) <= toDateStr(addDays(todayDate, -todayDate.getDay()))
      : monthIndex(monthCursor) <= monthIndex(todayDate);
  const nextDisabled =
    viewMode === 'week'
      ? toDateStr(weekDays[0]) >= toDateStr(addDays(maxDateObj, -maxDateObj.getDay()))
      : monthIndex(monthCursor) >= monthIndex(maxDateObj);

  // Arrow keys move the roving-tabindex cell by day/week; Home/End jump
  // to the start/end of the focused date's week. A move that lands
  // before `today` or after `maxDate` is a no-op - those dates are
  // unreachable (rendered `disabled`, which native buttons can't accept
  // focus on anyway), so this reads as the navigation simply stopping at
  // the edge of the bookable range rather than doing nothing visibly.
  function moveFocus(from: string, deltaDays: number) {
    const [y, m, d] = from.split('-').map(Number);
    const next = addDays(new Date(y, m - 1, d), deltaDays);
    const ds = toDateStr(next);
    if (ds < today || ds > maxDate) return;

    // Bring the target date's week/month into view if arrowing past the
    // edge of what's currently rendered - otherwise the ref the focus
    // effect looks for wouldn't exist yet.
    if (viewMode === 'week') {
      const currentWeekStart = toDateStr(weekDays[0]);
      const currentWeekEnd = toDateStr(weekDays[6]);
      if (ds < currentWeekStart || ds > currentWeekEnd) setWeekStart(next);
    } else {
      if (next.getMonth() !== monthCursor.getMonth() || next.getFullYear() !== monthCursor.getFullYear()) {
        // Only actually jump the month cursor if the target isn't one of
        // the leading/trailing days of an adjacent month already shown
        // in this 6-week grid.
        const stillVisible = monthDays.some((day) => toDateStr(day) === ds);
        if (!stillVisible) setMonthCursor(next);
      }
    }
    pendingFocusRef.current = true;
    setFocusedDate(ds);
  }

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, ds: string) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(ds, -1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(ds, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(ds, -7);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(ds, 7);
        break;
      case 'Home': {
        e.preventDefault();
        const [y, m, d] = ds.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        moveFocus(ds, -dow);
        break;
      }
      case 'End': {
        e.preventDefault();
        const [y, m, d] = ds.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        moveFocus(ds, 6 - dow);
        break;
      }
    }
  }

  function dateAriaLabel(d: Date, ds: string, opts: { isSelected: boolean; isToday: boolean; isFull: boolean }): string {
    let label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (opts.isToday) label += ', today';
    if (opts.isFull) label += ', no openings';
    if (opts.isSelected) label += ', selected';
    return label;
  }

  // Whichever grid is actually on screen right now - fetches once per
  // range (view toggle, prev/next) rather than once per day, via
  // /api/availability/range's single bulk answer.
  const visibleDays = viewMode === 'week' ? weekDays : monthDays;
  const rangeStart = toDateStr(visibleDays[0]);
  const rangeEnd = toDateStr(visibleDays[visibleDays.length - 1]);
  const fetchSeq = useRef(0);

  // Paging the view with the Prev/Next mouse buttons (or toggling
  // week/month) doesn't move focusedDate - so without this, a page-away
  // could leave focusedDate pointing at a date no longer rendered, which
  // means literally no cell in the new grid carries tabIndex 0 and
  // Tab skips the whole calendar. Falls back to the first bookable date
  // in the newly visible range whenever that happens; a no-op otherwise.
  useEffect(() => {
    const stillVisible = visibleDays.some((day) => toDateStr(day) === focusedDate);
    if (stillVisible) return;
    const fallback = visibleDays.find((day) => {
      const ds = toDateStr(day);
      return ds >= today && ds <= maxDate;
    });
    if (fallback) setFocusedDate(toDateStr(fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    if (!businessId || !serviceId) return;
    const seq = ++fetchSeq.current;
    fetch(
      `/api/availability/range?businessId=${businessId}&serviceId=${serviceId}&start=${rangeStart}&end=${rangeEnd}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // A slower earlier request landing after a faster later one used
        // to overwrite fresher data with stale results - only the most
        // recent request's answer is allowed to apply.
        if (seq !== fetchSeq.current || !data?.days) return;
        setAvailability((prev) => ({ ...prev, ...data.days }));
      })
      .catch(() => {
        // No per-day signal is a silent degrade, not an error state - the
        // calendar still works exactly as it did before this existed.
      });
  }, [businessId, serviceId, rangeStart, rangeEnd]);

  const weekdaysHeader = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div>
      {/* Nav bar */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={prevDisabled}
            onClick={() => {
              if (viewMode === 'week') setWeekStart(addDays(weekStart, -7));
              else setMonthCursor(addMonths(monthCursor, -1));
            }}
            className="flex items-center justify-center h-11 w-11 rounded-xl text-ink-faint hover:text-ink hover:bg-warm-surface transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-faint disabled:active:scale-100"
            aria-label="Previous month"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="font-display text-[14px] sm:text-[15px] font-semibold text-ink min-w-[104px] sm:min-w-[140px] text-center select-none">
            {viewMode === 'week'
              ? weekDays[3].toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
              : monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>

          <button
            type="button"
            disabled={nextDisabled}
            onClick={() => {
              if (viewMode === 'week') setWeekStart(addDays(weekStart, 7));
              else setMonthCursor(addMonths(monthCursor, 1));
            }}
            className="flex items-center justify-center h-11 w-11 rounded-xl text-ink-faint hover:text-ink hover:bg-warm-surface transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-faint disabled:active:scale-100"
            aria-label="Next month"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Pill toggle */}
        <div className="flex p-0.5 bg-warm-surface rounded-lg">
          {(['week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3.5 py-2 min-h-[40px] rounded-md text-[12px] font-mono font-medium uppercase tracking-wide transition-all duration-200 ${
                viewMode === mode
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-faint hover:text-ink'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-7 gap-1.5 animate-rise" aria-label="Choose a date">
          {weekDays.map((d) => {
            const ds = toDateStr(d);
            const disabled = ds < today || ds > maxDate;
            const isSelected = ds === selectedDate;
            const isToday = ds === today;
            // Only ever true once the range fetch has actually answered
            // for this date - `undefined` (still loading, or businessId/
            // serviceId not passed at all) never mutes anything.
            const isFull = !disabled && availability[ds] === false;
            return (
              <button
                type="button"
                key={ds}
                ref={(el) => { btnRefs.current[ds] = el; }}
                disabled={disabled}
                onClick={() => pickDate(d)}
                onKeyDown={(e) => handleGridKeyDown(e, ds)}
                tabIndex={ds === focusedDate ? 0 : -1}
                aria-label={dateAriaLabel(d, ds, { isSelected, isToday, isFull })}
                aria-current={isToday ? 'date' : undefined}
                aria-pressed={isSelected}
                style={isSelected ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all duration-200 ${
                  disabled
                    ? 'opacity-45 cursor-not-allowed'
                    : isSelected
                    ? 'shadow-glow font-semibold'
                    : 'hover:bg-warm-surface active:scale-95'
                }`}
              >
                <span className={`text-[12px] font-mono uppercase tracking-wide ${
                  isSelected ? 'opacity-80' : 'text-ink-faint'
                }`}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
                </span>
                {/* Muted text, not a strikethrough or a second badge - the
                    same "de-emphasized" treatment text-ink-faint already
                    carries everywhere else in the app, applied here to
                    mean "still bookable, but nothing's open" rather than
                    inventing a new visual language just for this. */}
                <span className={`font-display text-[17px] font-semibold leading-none ${isFull && !isSelected ? 'text-ink-faint' : ''}`}>
                  {d.getDate()}
                </span>
                {isToday && !isSelected && (
                  <div className="absolute bottom-1.5 h-1 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="animate-rise">
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {weekdaysHeader.map((h) => (
              <span key={h} className="text-[12px] font-mono uppercase tracking-wide text-ink-faint py-1 select-none">
                {h}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" aria-label="Choose a date">
            {monthDays.map((d) => {
              const ds = toDateStr(d);
              const isCurrentMonth = d.getMonth() === monthCursor.getMonth();
              const disabled = ds < today || ds > maxDate;
              const isSelected = ds === selectedDate;
              const isToday = ds === today;
              const isFull = !disabled && availability[ds] === false;
              return (
                <button
                  type="button"
                  key={ds}
                  ref={(el) => { btnRefs.current[ds] = el; }}
                  disabled={disabled}
                  onClick={() => {
                    if (!isCurrentMonth) {
                      // A peeking adjacent-month day used to select AND
                      // silently jump the whole grid to a different month
                      // in one click - genuinely easy to hit by accident
                      // reaching for the first/last row. One click now
                      // just brings that month into view (same as the
                      // Prev/Next arrows do); the day itself is left
                      // focused, so a second click - now clearly on an
                      // in-month day - actually picks it.
                      setMonthCursor(d);
                      pendingFocusRef.current = true;
                      setFocusedDate(ds);
                      return;
                    }
                    pickDate(d);
                  }}
                  onKeyDown={(e) => handleGridKeyDown(e, ds)}
                  tabIndex={ds === focusedDate ? 0 : -1}
                  aria-label={dateAriaLabel(d, ds, { isSelected, isToday, isFull })}
                  aria-current={isToday ? 'date' : undefined}
                  aria-pressed={isSelected}
                  style={
                    isSelected
                      ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                      : isToday && isCurrentMonth
                        ? { boxShadow: '0 0 0 1px color-mix(in srgb, var(--ink) 10%, transparent)' }
                        : undefined
                  }
                  className={`flex items-center justify-center h-11 sm:h-10 rounded-lg transition-all duration-150 font-display text-[14px] ${
                    disabled
                      ? 'opacity-40 cursor-not-allowed line-through'
                      : !isCurrentMonth
                      ? isSelected
                        ? 'font-semibold shadow-glow'
                        : 'text-ink-faint opacity-40 hover:bg-warm-surface'
                      : isSelected
                      ? 'font-semibold shadow-glow'
                      : isToday
                      ? 'font-semibold text-ink'
                      : isFull
                      ? 'text-ink-faint hover:bg-warm-surface active:scale-90'
                      : 'text-ink hover:bg-warm-surface active:scale-90'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
