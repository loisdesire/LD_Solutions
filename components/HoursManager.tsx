'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import CheckIcon from './CheckIcon';
import { useToast } from './Toast';

type Interval = { start: string; end: string };
type DayHours = { open: boolean; intervals: Interval[] };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_INDICES = [1, 2, 3, 4, 5]; // Monday-Friday

function defaultInterval(): Interval {
  return { start: '09:00', end: '17:00' };
}

// A rough preview of what customers would actually see, in example
// 30-minute steps - not the real slot list (that depends on which
// service's own duration a customer picks, plus existing bookings, both
// of which lib/getAvailableSlots.ts already computes server-side for the
// real booking form). This is deliberately simpler: pure wall-clock
// formatting, no timezone conversion needed since nothing here is being
// compared against a real Date instant, just visualizing the pattern
// these windows produce.
function previewSlots(intervals: Interval[], stepMinutes = 30): string[] {
  const slots: string[] = [];
  for (const iv of intervals) {
    const [sh, sm] = iv.start.split(':').map(Number);
    const [eh, em] = iv.end.split(':').map(Number);
    let cursor = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cursor + stepMinutes <= end) {
      const h = Math.floor(cursor / 60);
      const m = cursor % 60;
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      slots.push(`${h12}:${String(m).padStart(2, '0')} ${period}`);
      cursor += stepMinutes;
    }
  }
  return slots;
}

// Slot generation (lib/slotGenerator.ts) already loops over every
// availability row for a day, not just the first - a lunch-break business
// with a 9-12 and a 14-18 row has always been something the backend could
// serve correctly. Only the UI enforced "one window per day", by
// deleting-then-inserting a single row on every save. This rewrite just
// stops leaving that capability on the table.
export default function HoursManager({
  businessId,
  initialAvailability,
}: {
  businessId: string;
  initialAvailability: { day_of_week: number; start_time: string; end_time: string }[];
}) {
  const initial: DayHours[] = Array.from({ length: 7 }, (_, dayIndex) => {
    const rows = initialAvailability
      .filter((a) => a.day_of_week === dayIndex)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return rows.length > 0
      ? { open: true, intervals: rows.map((r) => ({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) })) }
      : { open: false, intervals: [defaultInterval()] };
  });

  const [days, setDays] = useState<DayHours[]>(initial);
  const [selectedDay, setSelectedDay] = useState(() => {
    const firstOpen = initial.findIndex((day) => day.open);
    return firstOpen >= 0 ? firstOpen : 1;
  });
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [savedDay, setSavedDay] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();
  const showToast = useToast();

  function updateDay(index: number, patch: Partial<DayHours>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSavedDay(null);
  }

  function updateInterval(dayIndex: number, intervalIndex: number, patch: Partial<Interval>) {
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIndex
          ? d
          : { ...d, intervals: d.intervals.map((iv, j) => (j === intervalIndex ? { ...iv, ...patch } : iv)) }
      )
    );
    setSavedDay(null);
  }

  function addInterval(dayIndex: number) {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        // Starts where the last window left off, not always 9-5 again -
        // the common case for a second window is a lunch-break business
        // reopening in the afternoon.
        const last = d.intervals[d.intervals.length - 1];
        const next: Interval = last ? { start: last.end, end: '18:00' } : defaultInterval();
        return { ...d, intervals: [...d.intervals, next] };
      })
    );
    setSavedDay(null);
  }

  function removeInterval(dayIndex: number, intervalIndex: number) {
    setDays((prev) =>
      prev.map((d, i) => (i !== dayIndex ? d : { ...d, intervals: d.intervals.filter((_, j) => j !== intervalIndex) }))
    );
    setSavedDay(null);
  }

  // One business_id + day_of_week combination, fully replaced: delete
  // whatever windows exist for that day, then insert whichever ones the
  // form currently holds (none, if the day is closed).
  async function persistDay(index: number, day: DayHours): Promise<boolean> {
    const { error: deleteError } = await supabase
      .from('availability')
      .delete()
      .eq('business_id', businessId)
      .eq('day_of_week', index)
      .is('staff_id', null);

    if (deleteError) {
      setError(friendlyError(deleteError));
      return false;
    }

    if (day.open && day.intervals.length > 0) {
      const { error: insertError } = await supabase.from('availability').insert(
        day.intervals.map((iv) => ({
          business_id: businessId,
          day_of_week: index,
          start_time: iv.start,
          end_time: iv.end,
        }))
      );
      if (insertError) {
        setError(friendlyError(insertError));
        return false;
      }
    }

    return true;
  }

  async function saveDay(index: number) {
    setSavingDay(index);
    setError('');

    const ok = await persistDay(index, days[index]);
    setSavingDay(null);

    if (!ok) {
      showToast('Could not save that day', 'error');
      return;
    }
    setSavedDay(index);
    // Keeps the inline "Saved ✓" on the button too (more precise - shows
    // exactly which day just saved) - the toast adds the same
    // cross-page confirmation pattern every other manager uses, on top
    // of that, not instead of it.
    showToast(`${DAY_NAMES[index]}'s hours saved`);
  }

  // Copies the selected day's open/closed state and every window onto
  // Monday-Friday, then saves all five at once - the single most common
  // real-world case (same hours all week) used to take five separate
  // "Save day" clicks with nothing to speed it up.
  async function copyToWeekdays() {
    const source = days[selectedDay];
    const clone = (): DayHours => ({ open: source.open, intervals: source.intervals.map((iv) => ({ ...iv })) });

    setCopying(true);
    setError('');

    const nextDays = days.map((d, i) => (WEEKDAY_INDICES.includes(i) ? clone() : d));
    setDays(nextDays);

    const results = await Promise.all(WEEKDAY_INDICES.map((i) => persistDay(i, nextDays[i])));
    setCopying(false);

    if (results.every(Boolean)) {
      showToast(`${DAY_NAMES[selectedDay]}'s hours copied to Monday-Friday`);
    } else {
      showToast('Copied here, but saving some days failed - check them individually', 'error');
    }
  }

  const day = days[selectedDay];

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="rounded-3xl border-2 border-line bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink-faint">Weekly rhythm</p>
            <h2 className="font-display text-[19px] text-ink mt-1">When can people reach you?</h2>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d, index) => (
            <button
              key={DAY_NAMES[index]}
              type="button"
              onClick={() => setSelectedDay(index)}
              className={`relative min-w-0 rounded-2xl px-1.5 py-3 text-center transition-colors ${
                selectedDay === index ? 'bg-accent text-accent-contrast' : 'bg-warm-surface text-ink-soft hover:bg-ink-wash'
              }`}
            >
              <span className="block font-mono text-[9px] uppercase tracking-[0.08em]">{DAY_NAMES[index].slice(0, 3)}</span>
              <span className={`mx-auto mt-2 block h-2 w-2 rounded-full ${d.open ? selectedDay === index ? 'bg-white' : 'bg-accent' : selectedDay === index ? 'bg-white/40' : 'bg-line-strong'}`} />
              <span className="sr-only">{d.open ? 'Open' : 'Closed'}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-[22px] text-ink">{DAY_NAMES[selectedDay]}</h3>
              <button
                type="button"
                onClick={() => updateDay(selectedDay, { open: !day.open })}
                className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2.5 py-1 ${day.open ? 'bg-accent-soft text-accent' : 'bg-ink-wash text-ink-faint'}`}
              >
                {day.open ? 'Open' : 'Closed'}
              </button>
            </div>
            <button
              type="button"
              onClick={copyToWeekdays}
              disabled={copying}
              className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-faint hover:text-accent transition-colors disabled:opacity-50"
            >
              {copying ? 'Copying…' : `Copy ${DAY_NAMES[selectedDay]} to Mon-Fri`}
            </button>
          </div>

          {day.open ? (
            <div className="space-y-2.5">
              {day.intervals.map((iv, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <input
                    aria-label={`${DAY_NAMES[selectedDay]} window ${i + 1} opening time`}
                    type="time"
                    value={iv.start}
                    onChange={(e) => updateInterval(selectedDay, i, { start: e.target.value })}
                    className="rounded-xl border-2 border-line-strong bg-surface px-3 py-2 text-body-sm font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                  />
                  <span className="font-mono text-[12px] text-ink-faint">to</span>
                  <input
                    aria-label={`${DAY_NAMES[selectedDay]} window ${i + 1} closing time`}
                    type="time"
                    value={iv.end}
                    onChange={(e) => updateInterval(selectedDay, i, { end: e.target.value })}
                    className="rounded-xl border-2 border-line-strong bg-surface px-3 py-2 text-body-sm font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                  />
                  {day.intervals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInterval(selectedDay, i)}
                      aria-label={`Remove window ${i + 1}`}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-ink-faint hover:text-error hover:bg-error-bg transition-colors shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
              ))}
              {/* A second window is how a lunch-break or split-shift
                  business is represented - 9-12 and 14-18 as two rows
                  rather than one window pretending the middle of the day
                  is bookable. */}
              <button
                type="button"
                onClick={() => addInterval(selectedDay)}
                className="inline-flex items-center gap-1.5 text-caption font-semibold hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
                Add another window
              </button>

              {/* What this actually produces, not just the raw start/end
                  numbers - a business owner setting windows for the first
                  time has to mentally simulate "so what times does that
                  give someone" otherwise. Example only (real duration
                  comes from whichever service a customer picks), labelled
                  as such. */}
              {(() => {
                const preview = previewSlots(day.intervals);
                return preview.length > 0 ? (
                  <div className="mt-4 pt-4 border-t border-dashed border-line">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mb-2">
                      Example 30-min slots customers would see
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.slice(0, 12).map((s) => (
                        <span key={s} className="font-mono text-[11px] text-ink-soft bg-warm-surface rounded-full px-2.5 py-1">
                          {s}
                        </span>
                      ))}
                      {preview.length > 12 && (
                        <span className="font-mono text-[11px] text-ink-faint px-1 py-1">+{preview.length - 12} more</span>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <p className="text-caption text-ink-faint">Turn this day on to accept appointments.</p>
          )}

          <div className="mt-5">
            <button
              type="button"
              onClick={() => saveDay(selectedDay)}
              disabled={savingDay === selectedDay}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-caption font-medium text-accent-contrast hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {savingDay === selectedDay ? 'Saving…' : savedDay === selectedDay ? <>Saved <CheckIcon className="h-3 w-3" /></> : 'Save day'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-ink-faint">The dots show your weekly pattern. Select a day to adjust its opening windows.</p>
    </div>
  );
}
