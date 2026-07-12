'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

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
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {days.map((day, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <label className="flex items-center gap-3 w-32 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={day.open}
              onChange={(e) => updateDay(index, { open: e.target.checked })}
              className="h-4 w-4 rounded accent-accent"
            />
            <span className="font-semibold text-sm">{DAY_NAMES[index]}</span>
          </label>

          {day.open ? (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={day.start}
                onChange={(e) => updateDay(index, { start: e.target.value })}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
              <span className="text-muted text-sm">to</span>
              <input
                type="time"
                value={day.end}
                onChange={(e) => updateDay(index, { end: e.target.value })}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
            </div>
          ) : (
            <p className="text-muted text-sm">Closed</p>
          )}

          <button
            onClick={() => saveDay(index)}
            disabled={savingDay === index}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-50 sm:ml-auto"
          >
            {savingDay === index ? 'Saving…' : savedDay === index ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      ))}
    </div>
  );
}
