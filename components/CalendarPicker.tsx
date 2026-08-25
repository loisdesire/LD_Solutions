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

  useEffect(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const newD = new Date(y, m - 1, d);
      setWeekStart(newD);
      setMonthCursor(newD);
    }
  }, [selectedDate]);

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

  // Whichever grid is actually on screen right now - fetches once per
  // range (view toggle, prev/next) rather than once per day, via
  // /api/availability/range's single bulk answer.
  const visibleDays = viewMode === 'week' ? weekDays : monthDays;
  const rangeStart = toDateStr(visibleDays[0]);
  const rangeEnd = toDateStr(visibleDays[visibleDays.length - 1]);
  const fetchSeq = useRef(0);

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
            onClick={() => {
              if (viewMode === 'week') setWeekStart(addDays(weekStart, -7));
              else setMonthCursor(addMonths(monthCursor, -1));
            }}
            className="flex items-center justify-center h-11 w-11 rounded-xl text-ink-faint hover:text-ink hover:bg-warm-surface transition-all active:scale-90"
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
            onClick={() => {
              if (viewMode === 'week') setWeekStart(addDays(weekStart, 7));
              else setMonthCursor(addMonths(monthCursor, 1));
            }}
            className="flex items-center justify-center h-11 w-11 rounded-xl text-ink-faint hover:text-ink hover:bg-warm-surface transition-all active:scale-90"
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
              className={`px-3.5 py-2 min-h-[40px] rounded-md text-[11px] font-mono font-medium uppercase tracking-wider transition-all duration-200 ${
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
        <div className="grid grid-cols-7 gap-1.5 animate-rise">
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
                disabled={disabled}
                onClick={() => pickDate(d)}
                style={isSelected ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all duration-200 ${
                  disabled
                    ? 'opacity-45 cursor-not-allowed'
                    : isSelected
                    ? 'shadow-glow font-semibold'
                    : 'hover:bg-warm-surface active:scale-95'
                }`}
              >
                <span className={`text-[10px] font-mono uppercase tracking-widest ${
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
              <span key={h} className="text-[10px] font-mono uppercase tracking-widest text-ink-faint py-1 select-none">
                {h}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                  disabled={disabled}
                  onClick={() => pickDate(d)}
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
