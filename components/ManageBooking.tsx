'use client';

import { useState, useEffect, useMemo } from 'react';
import CalendarPicker from './CalendarPicker';
import Skeleton from './Skeleton';

type Period = 'Morning' | 'Afternoon' | 'Evening';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function groupSlots(slots: string[]): [Period, string[]][] {
  const order: Period[] = ['Morning', 'Afternoon', 'Evening'];
  const groups: Record<Period, string[]> = { Morning: [], Afternoon: [], Evening: [] };
  for (const s of slots) {
    const h = new Date(s).getHours();
    const period: Period = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    groups[period].push(s);
  }
  return order.filter((p) => groups[p].length > 0).map((p) => [p, groups[p]]);
}

export default function ManageBooking({
  bookingId,
  businessId,
  serviceId,
  initialStatus,
  startTime,
  maxAdvanceDays = 30,
}: {
  bookingId: string;
  businessId: string;
  serviceId: string;
  initialStatus: string;
  startTime: string;
  maxAdvanceDays?: number;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(toDateStr(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  // Without these, every date change rendered "0 open" and "No openings
  // this day" for the entire duration of the fetch — telling a customer
  // trying to reschedule that the business was full, on every single click.
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  // Forces a refetch of the same date — setDate(d => d) would be a no-op,
  // since React bails out when state is identical.
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [rescheduled, setRescheduled] = useState(false);

  const today = toDateStr(new Date());
  const maxDate = toDateStr(new Date(Date.now() + maxAdvanceDays * 86400000));

  const slotGroups = useMemo(() => groupSlots(slots), [slots]);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(false);
    setSlots([]);
    fetch(`/api/availability?businessId=${businessId}&serviceId=${serviceId}&date=${date}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('availability request failed');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data?.slots)) throw new Error('malformed availability response');
        setSlots(data.slots);
      })
      .catch(() => {
        if (!cancelled) setSlotsError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, businessId, serviceId, reloadKey]);

  async function handleCancel() {
    setLoading(true);
    setError('');

    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      return;
    }

    setStatus('cancelled');
  }

  async function handleReschedule() {
    if (!selectedSlot) return;
    setLoading(true);
    setError('');

    const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStartTime: selectedSlot }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      return;
    }

    setRescheduling(false);
    setRescheduled(true);
  }

  if (status === 'cancelled') {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="font-semibold text-[14px]">This booking has been cancelled.</p>
      </div>
    );
  }

  // Reschedule/cancel only make sense for something that hasn't happened
  // yet — this used to show both buttons unconditionally, so a booking
  // from last week still looked fully actionable.
  if (new Date(startTime).getTime() < Date.now()) {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="font-semibold text-[14px]">This appointment has already happened.</p>
        <p className="text-ink-soft text-[13px] mt-1">Nothing to manage here anymore.</p>
      </div>
    );
  }

  if (rescheduled) {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="font-semibold text-[14px]">Your booking has been rescheduled.</p>
        <p className="text-ink-soft text-[13px] mt-1">Refresh this page to see the new time.</p>
      </div>
    );
  }

  if (rescheduling) {
    return (
      <div className="border-2 border-line-strong bg-surface rounded-2xl p-6 space-y-5 animate-rise shadow-soft">
        <div>
          <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-2">
            New date
          </label>
          <CalendarPicker
            selectedDate={date}
            onChange={(d) => {
              setDate(toDateStr(d));
              setSelectedSlot('');
            }}
            today={today}
            maxDate={maxDate}
          />
        </div>

        {date && (
          <div className="pt-2 animate-rise">
            <div className="flex items-center justify-between mb-3">
              <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                Available times
              </label>
              {!loadingSlots && !slotsError && (
                <span className="font-mono text-[11px] text-ink-faint">{slots.length} open</span>
              )}
            </div>
            {loadingSlots ? (
              <div className="space-y-4 mb-4">
                {[0, 1].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-2.5 w-16 rounded mb-2" />
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2].map((j) => (
                        <Skeleton key={j} className="w-[72px] h-[34px] rounded-lg" delay={j * 0.15} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : slotsError ? (
              <div className="border-2 border-dashed border-line-strong rounded-xl py-6 flex flex-col items-center text-center px-4">
                <p className="text-ink-soft text-[13px]">We couldn&rsquo;t load available times.</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-3 rounded-full border-2 border-line-strong px-4 py-1.5 text-[12.5px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : slots.length === 0 ? (
              <div className="border-2 border-dashed border-line-strong rounded-xl py-6 flex flex-col items-center text-center px-4">
                <p className="text-ink-soft text-[13px]">No openings this day. Try another date.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-4">
                {slotGroups.map(([period, times]) => (
                  <div key={period}>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint mb-2">
                      {period}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {times.map((t) => {
                        const isSel = t === selectedSlot;
                        return (
                          <button
                            type="button"
                            key={t}
                            onClick={() => setSelectedSlot(t)}
                            style={
                              isSel
                                ? {
                                    background: 'var(--accent)',
                                    borderColor: 'var(--accent)',
                                    color: 'var(--accent-contrast)',
                                  }
                                : undefined
                            }
                            className={`min-w-[80px] py-2 px-3 text-[13px] font-mono font-semibold tabular-nums border-2 rounded-full transition-all active:scale-95 ${
                              isSel
                                ? 'animate-punch shadow-[0_4px_12px_-2px_var(--accent)]'
                                : 'border-line-strong bg-surface hover:border-[var(--accent)] hover:-translate-y-0.5'
                            }`}
                          >
                            {formatTime(t)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleReschedule}
            disabled={loading || !selectedSlot}
            style={selectedSlot ? { background: 'var(--accent)' } : undefined}
            className="flex-1 rounded-xl py-3 text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Confirm new time'}
          </button>
          <button
            onClick={() => setRescheduling(false)}
            className="rounded-xl border-2 border-line-strong px-4 py-3 text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>

        {error && <p className="text-sm text-error mt-2">{error}</p>}
      </div>
    );
  }


  return (
    <div className="border-2 border-line rounded-2xl p-5 flex flex-col sm:flex-row gap-3 bg-surface">
      <button
        onClick={() => setRescheduling(true)}
        className="flex-1 rounded-xl border-2 border-line-strong py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
      >
        Reschedule
      </button>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="flex-1 rounded-xl border-2 border-error-border bg-error-bg py-2.5 text-[13.5px] font-semibold text-error transition-colors hover:opacity-80 disabled:opacity-50"
      >
        {loading ? 'Cancelling…' : 'Cancel booking'}
      </button>
      {error && <p className="text-sm text-error w-full">{error}</p>}
    </div>
  );
}
