'use client';

import { useState, useEffect, useMemo } from 'react';
import CalendarPicker from './CalendarPicker';

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
    fetch(`/api/availability?businessId=${businessId}&serviceId=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []));
  }, [date, businessId, serviceId]);

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
      <div className="border border-line rounded-md p-5 text-center">
        <p className="font-semibold text-[14px]">This booking has been cancelled.</p>
      </div>
    );
  }

  // Reschedule/cancel only make sense for something that hasn't happened
  // yet — this used to show both buttons unconditionally, so a booking
  // from last week still looked fully actionable.
  if (new Date(startTime).getTime() < Date.now()) {
    return (
      <div className="border border-line rounded-md p-5 text-center">
        <p className="font-semibold text-[14px]">This appointment has already happened.</p>
        <p className="text-ink-soft text-[13px] mt-1">Nothing to manage here anymore.</p>
      </div>
    );
  }

  if (rescheduled) {
    return (
      <div className="border border-line rounded-md p-5 text-center">
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
              <span className="font-mono text-[11px] text-ink-faint">{slots.length} open</span>
            </div>
            {slots.length === 0 ? (
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
            className="flex-1 rounded-lg py-3 text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Confirm new time'}
          </button>
          <button
            onClick={() => setRescheduling(false)}
            className="rounded-lg border border-line-strong px-4 py-3 text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    );
  }


  return (
    <div className="border border-line rounded-md p-5 flex flex-col sm:flex-row gap-3">
      <button
        onClick={() => setRescheduling(true)}
        className="flex-1 rounded-md border border-line-strong py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
      >
        Reschedule
      </button>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="flex-1 rounded-md border border-red-200 bg-red-50 py-2.5 text-[13.5px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? 'Cancelling…' : 'Cancel booking'}
      </button>
      {error && <p className="text-sm text-red-600 w-full">{error}</p>}
    </div>
  );
}
