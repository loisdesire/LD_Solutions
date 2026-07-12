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
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft text-center">
        <p className="font-semibold">This booking has been cancelled.</p>
      </div>
    );
  }

  if (rescheduled) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft text-center">
        <p className="font-semibold">Your booking has been rescheduled.</p>
        <p className="text-muted text-sm mt-1">Refresh this page to see the new time.</p>
      </div>
    );
  }

  if (rescheduling) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">New date</label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => {
              setDate(e.target.value);
              setSelectedSlot('');
            }}
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-ink shadow-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </div>

        {date && (
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Available times</label>
            {slots.length === 0 ? (
              <p className="text-sm text-muted">No open slots this day. Try another date.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
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
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-brand text-white shadow-glow'
                          : 'border border-line bg-white text-ink hover:border-accent hover:text-accent'
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
            className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Confirm new time'}
          </button>
          <button
            onClick={() => setRescheduling(false)}
            className="rounded-xl border border-line px-4 py-3 text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft space-y-3">
      <button
        onClick={() => setRescheduling(true)}
        className="w-full rounded-xl border border-line py-3.5 text-sm font-semibold text-ink transition-all hover:border-accent hover:text-accent"
      >
        Reschedule
      </button>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="w-full rounded-xl border border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? 'Cancelling…' : 'Cancel this booking'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
