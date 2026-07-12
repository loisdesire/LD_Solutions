'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
};

export default function BookingForm({
  businessId,
  slug,
  services,
  maxAdvanceDays,
}: {
  businessId: string;
  slug: string;
  services: Service[];
  maxAdvanceDays: number;
}) {
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [bookingId, setBookingId] = useState('');

  const selectedService = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([]);
      return;
    }
    fetch(
      `/api/availability?businessId=${businessId}&serviceId=${serviceId}&date=${date}`
    )
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []));
  }, [serviceId, date, businessId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setStatus('saving');

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        serviceId,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        startTime: selectedSlot,
        durationMinutes: selectedService.duration_minutes,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setBookingId(data.booking.id);
      setStatus('done');
    } else {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="text-center py-16 rounded-2xl border border-line bg-white shadow-soft animate-rise">
        <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-brand shadow-glow flex items-center justify-center text-white text-xl">
          ✓
        </div>
        <h3 className="text-xl font-extrabold tracking-tight mb-2">You're booked!</h3>
        <p className="text-muted text-sm mb-4">
          A confirmation is on its way to {email}.
        </p>
        <Link
          href={`/${slug}/manage/${bookingId}`}
          className="text-sm font-medium text-accent hover:underline"
        >
          Need to cancel? Manage your booking →
        </Link>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder-muted/60 shadow-sm outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/10';

  const labelClass = 'block text-sm font-medium text-ink mb-1.5';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-line bg-white p-6 shadow-soft"
    >
      <div>
        <label className={labelClass}>Service</label>
        <select
          required
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setSelectedSlot('');
          }}
          className={`${inputClass} appearance-none`}
        >
          <option value="">Select a service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.duration_minutes} min{s.price ? ` · ₦${s.price}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Date</label>
        <input
          required
          type="date"
          value={date}
          min={new Date().toISOString().split('T')[0]}
          max={
            new Date(Date.now() + maxAdvanceDays * 86400000).toISOString().split('T')[0]
          }
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlot('');
          }}
          className={inputClass}
        />
      </div>

      {date && serviceId && (
        <div>
          <label className={labelClass}>Available times</label>
          {slots.length === 0 ? (
            <p className="text-sm text-muted rounded-xl border border-dashed border-line px-4 py-3">
              No open slots this day. Try another date.
            </p>
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

      <div className="h-px bg-line" />

      <div className="grid grid-cols-1 gap-5">
        <div>
          <label className={labelClass}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === 'saving' || !selectedSlot}
        className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {status === 'saving' ? 'Booking…' : 'Confirm booking →'}
      </button>

      {status === 'error' && (
        <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
