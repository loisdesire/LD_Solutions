'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';

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
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [savedDay, setSavedDay] = useState<number | null>(null);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();

  function updateDay(index: number, patch: Partial<Hours>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSavedDay(null);
  }

  async function saveDay(index: number) {
    setSavingDay(index);
    setError('');
    const day = days[index];

    // Business-wide hours only (staff_id null) — replace whatever was
    // there for this day of week with the single window in the form.
    const { error: deleteError } = await supabase
      .from('availability')
      .delete()
      .eq('business_id', businessId)
      .eq('day_of_week', index)
      .is('staff_id', null);

    if (deleteError) {
      setError(deleteError.message);
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
        setSavingDay(null);
        return;
      }
    }

    setSavingDay(null);
    setSavedDay(index);
  }

  return (
    <div>
      {error && <p className="text-sm text-error mb-4">{error}</p>}
      <div className="border-2 border-line rounded-2xl overflow-hidden bg-surface">
        {days.map((day, index) => (
          <div
            key={index}
            className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 ${
              index !== days.length - 1 ? 'border-b border-line' : ''
            }`}
          >
            <div
              className="flex items-center gap-3 w-32 shrink-0 cursor-pointer select-none"
              onClick={() => updateDay(index, { open: !day.open })}
            >
              <span
                role="checkbox"
                aria-checked={day.open}
                className={`h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  day.open ? 'bg-accent border-accent' : 'border-line-strong bg-surface'
                }`}
              >
                {day.open && <CheckIcon className="h-3 w-3 text-white" />}
              </span>
              <span className="font-semibold text-[14px]">{DAY_NAMES[index]}</span>
            </div>

            {day.open ? (
              <div className="flex items-center gap-2.5">
                <input
                  type="time"
                  value={day.start}
                  onChange={(e) => updateDay(index, { start: e.target.value })}
                  className="rounded-xl border-2 border-line-strong bg-surface px-3 py-1.5 text-[13.5px] font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                />
                <span className="font-mono text-[12px] text-ink-faint">to</span>
                <input
                  type="time"
                  value={day.end}
                  onChange={(e) => updateDay(index, { end: e.target.value })}
                  className="rounded-xl border-2 border-line-strong bg-surface px-3 py-1.5 text-[13.5px] font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                />
              </div>
            ) : (
              <p className="font-mono text-[12px] text-ink-faint tracking-[0.03em]">Closed</p>
            )}

            <button
              onClick={() => saveDay(index)}
              disabled={savingDay === index}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line-strong px-4 py-1.5 text-[12.5px] font-medium text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50 sm:ml-auto"
            >
              {savingDay === index ? (
                'Saving…'
              ) : savedDay === index ? (
                <>
                  Saved <CheckIcon className="h-3 w-3" />
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
