'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';
import { useToast } from './Toast';

type Hours = { start: string; end: string; open: boolean };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HoursManager({
  businessId,
  initialAvailability,
}: {
  businessId: string;
  initialAvailability: { day_of_week: number; start_time: string; end_time: string }[];
}) {
  const initial: Hours[] = Array.from({ length: 7 }, (_, day) => {
    const existing = initialAvailability.find((a) => a.day_of_week === day);
    return existing
      ? { open: true, start: existing.start_time.slice(0, 5), end: existing.end_time.slice(0, 5) }
      : { open: false, start: '09:00', end: '17:00' };
  });

  const [days, setDays] = useState<Hours[]>(initial);
  const [selectedDay, setSelectedDay] = useState(() => {
    const firstOpen = initial.findIndex((day) => day.open);
    return firstOpen >= 0 ? firstOpen : 1;
  });
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [savedDay, setSavedDay] = useState<number | null>(null);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();
  const showToast = useToast();

  function updateDay(index: number, patch: Partial<Hours>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSavedDay(null);
  }

  async function saveDay(index: number) {
    setSavingDay(index);
    setError('');
    const day = days[index];

    // Business-wide hours only (staff_id null) - replace whatever was
    // there for this day of week with the single window in the form.
    const { error: deleteError } = await supabase
      .from('availability')
      .delete()
      .eq('business_id', businessId)
      .eq('day_of_week', index)
      .is('staff_id', null);

    if (deleteError) {
      setError(deleteError.message);
      showToast('Could not save that day', 'error');
      setSavingDay(null);
      return;
    }

    if (day.open) {
      const { error: insertError } = await supabase.from('availability').insert({
        business_id: businessId,
        day_of_week: index,
        start_time: day.start,
        end_time: day.end,
      });

      if (insertError) {
        setError(insertError.message);
        showToast('Could not save that day', 'error');
        setSavingDay(null);
        return;
      }
    }

    setSavingDay(null);
    setSavedDay(index);
    // Keeps the inline "Saved ✓" on the button too (more precise - shows
    // exactly which day just saved) - the toast adds the same
    // cross-page confirmation pattern every other manager uses, on top
    // of that, not instead of it.
    showToast(`${DAY_NAMES[index]}'s hours saved`);
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="rounded-3xl border-2 border-line bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink-faint">Weekly rhythm</p>
            <h2 className="font-display text-[19px] text-ink mt-1">When can people reach you?</h2>
          </div>
          <span className="hidden sm:block font-mono text-[10px] text-ink-faint">One window per day</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((day, index) => (
            <button
              key={DAY_NAMES[index]}
              type="button"
              onClick={() => setSelectedDay(index)}
              className={`relative min-w-0 rounded-2xl px-1.5 py-3 text-center transition-colors ${
                selectedDay === index ? 'bg-accent text-white' : 'bg-warm-surface text-ink-soft hover:bg-ink-wash'
              }`}
            >
              <span className="block font-mono text-[9px] uppercase tracking-[0.08em]">{DAY_NAMES[index].slice(0, 3)}</span>
              <span className={`mx-auto mt-2 block h-2 w-2 rounded-full ${day.open ? selectedDay === index ? 'bg-white' : 'bg-accent' : selectedDay === index ? 'bg-white/40' : 'bg-line-strong'}`} />
              <span className="sr-only">{day.open ? 'Open' : 'Closed'}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t border-line pt-5">
          {(() => {
            const day = days[selectedDay];
            return (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display text-[22px] text-ink">{DAY_NAMES[selectedDay]}</h3>
                    <button
                      type="button"
                      onClick={() => updateDay(selectedDay, { open: !day.open })}
                      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2.5 py-1 ${day.open ? 'bg-accent-soft text-accent' : 'bg-ink-wash text-ink-faint'}`}
                    >
                      {day.open ? 'Open' : 'Closed'}
                    </button>
                  </div>
                  <p className="text-caption text-ink-faint">{day.open ? 'Set the window customers can book.' : 'Turn this day on to accept appointments.'}</p>
                </div>

                {day.open && (
                  <div className="flex items-center gap-2.5">
                    <input
                      aria-label={`${DAY_NAMES[selectedDay]} opening time`}
                      type="time"
                      value={day.start}
                      onChange={(e) => updateDay(selectedDay, { start: e.target.value })}
                      className="rounded-xl border-2 border-line-strong bg-surface px-3 py-2 text-body-sm font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    />
                    <span className="font-mono text-[12px] text-ink-faint">to</span>
                    <input
                      aria-label={`${DAY_NAMES[selectedDay]} closing time`}
                      type="time"
                      value={day.end}
                      onChange={(e) => updateDay(selectedDay, { end: e.target.value })}
                      className="rounded-xl border-2 border-line-strong bg-surface px-3 py-2 text-body-sm font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => saveDay(selectedDay)}
                  disabled={savingDay === selectedDay}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-caption font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingDay === selectedDay ? 'Saving…' : savedDay === selectedDay ? <>Saved <CheckIcon className="h-3 w-3" /></> : 'Save day'}
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      <p className="text-[12px] text-ink-faint">The dots show your weekly pattern. Select a day to adjust its opening window.</p>
    </div>
  );
}
