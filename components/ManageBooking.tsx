'use client';

import { useState, useEffect } from 'react';

export default function ManageBooking({
  bookingId,
  businessId,
  serviceId,
  initialStatus,
}: {
  bookingId: string;
  businessId: string;
  serviceId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [rescheduled, setRescheduled] = useState(false);

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
      <div className="border border-line rounded-md p-5 space-y-4">
        <div>
          <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">
            New date
          </label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => {
              setDate(e.target.value);
              setSelectedSlot('');
            }}
            className="w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        {date && (
          <div>
            <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-2">
              Available times
            </label>
            {slots.length === 0 ? (
              <p className="text-sm text-ink-soft">No open slots this day. Try another date.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const time = new Date(slot).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isSelected = selectedSlot === slot;
                  return (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      style={
                        isSelected
                          ? { background: 'var(--accent)', color: 'var(--accent-contrast)', borderColor: 'var(--accent)' }
                          : undefined
                      }
                      className={`py-2.5 text-[13px] font-mono border rounded-md transition-all ${
                        isSelected ? '' : 'border-line-strong bg-surface hover:border-accent'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleReschedule}
            disabled={loading || !selectedSlot}
            style={{ background: 'var(--accent)' }}
            className="flex-1 rounded-md py-2.5 text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Confirm new time'}
          </button>
          <button
            onClick={() => setRescheduling(false)}
            className="rounded-md border border-line-strong px-4 py-2.5 text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
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
