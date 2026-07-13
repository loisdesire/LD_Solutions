'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import CheckIcon from './CheckIcon';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
};

type Step = 'service' | 'datetime' | 'details' | 'confirmed';

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

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} hr` : `${h} hr ${rest} min`;
}

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
  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [bookingId, setBookingId] = useState('');

  const today = toDateStr(new Date());
  const maxDate = toDateStr(new Date(Date.now() + maxAdvanceDays * 86400000));

  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  useEffect(() => {
    if (!selectedService || !selectedDate) return;
    setLoadingSlots(true);
    fetch(`/api/availability?businessId=${businessId}&serviceId=${selectedService.id}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [selectedService, selectedDate, businessId]);

  function selectService(s: Service) {
    setSelectedService(s);
    setSelectedSlot('');
    setStep('datetime');
  }

  function pickDate(d: Date) {
    const ds = toDateStr(d);
    if (ds < today || ds > maxDate) return;
    setSelectedDate(ds);
    setSelectedSlot('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setStatus('saving');

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        serviceId: selectedService.id,
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
      setStatus('idle');
      setStep('confirmed');
    } else {
      setStatus('error');
    }
  }

  const stepIndex = { service: 0, datetime: 1, details: 2, confirmed: 3 }[step];

  const inputClass =
    'w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

  if (step === 'confirmed') {
    return (
      <div className="animate-rise text-center py-6">
        <div
          className="mx-auto mb-5 h-14 w-14 rounded-full flex items-center justify-center text-white"
          style={{ background: 'var(--accent)' }}
        >
          <CheckIcon className="h-6 w-6" />
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-2">
          Booking confirmed
        </div>
        <h2 className="font-display text-[26px] mb-2">You're all set, {name.split(' ')[0]}.</h2>
        <p className="text-ink-soft text-[14px] max-w-xs mx-auto">
          A confirmation has been sent to {email}.
        </p>

        <div className="border border-line rounded-md mt-8 text-left overflow-hidden">
          <div className="p-5 border-b border-dashed border-line-strong">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
              {selectedService?.name}
            </div>
            <div className="font-display text-[19px] mt-1">
              {selectedSlot &&
                new Date(selectedSlot).toLocaleString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
            </div>
            <div className="font-mono text-[13px] text-ink-soft mt-1.5">
              {selectedSlot &&
                new Date(selectedSlot).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
            </div>
          </div>
          <div className="p-4 flex items-center justify-between bg-paper">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Confirmed
            </span>
            <span className="font-mono text-[11px] text-ink-faint">
              #{bookingId.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        <Link
          href={`/${slug}/manage/${bookingId}`}
          className="inline-block mt-6 text-[13.5px] font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Manage this booking →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {step !== 'service' && (
        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-ink-faint mb-8">
          <span className={stepIndex >= 0 ? 'text-ink' : ''}>01 Service</span>
          <span>—</span>
          <span className={stepIndex >= 1 ? 'text-ink' : ''}>02 Time</span>
          <span>—</span>
          <span className={stepIndex >= 2 ? 'text-ink' : ''}>03 Details</span>
        </div>
      )}

      {step === 'service' && (
        <div className="animate-rise">
          {services.length === 0 ? (
            <p className="text-ink-soft text-[14px]">This business hasn't listed any services yet.</p>
          ) : (
            <div className="border-t border-line">
              {services.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => selectService(s)}
                  className="w-full flex items-center gap-4 py-4 border-b border-line text-left group hover:bg-paper transition-colors"
                >
                  <span className="font-mono text-[12px] text-ink-faint tabular-nums w-6 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-display text-[17px] text-ink transition-colors group-hover:text-[var(--accent)]"
                    >
                      {s.name}
                    </div>
                    <div className="text-[12.5px] text-ink-faint mt-0.5 font-mono">
                      {formatDuration(s.duration_minutes)}
                    </div>
                  </div>
                  {s.price != null && (
                    <div className="font-mono text-[15px] shrink-0">₦{s.price.toLocaleString()}</div>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-ink-faint group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all shrink-0">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'datetime' && selectedService && (
        <div className="animate-rise">
          <button
            onClick={() => setStep('service')}
            className="flex items-center gap-1 text-[13px] text-ink-faint hover:text-ink mb-6 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M15 6l-6 6 6 6" /></svg>
            Change service
          </button>

          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <h2 className="font-display text-[22px]">Choose a time</h2>
            <div className="text-right text-[13px] text-ink-soft">
              <div className="font-display text-[16px] text-ink">{selectedService.name}</div>
              <div className="font-mono text-[11.5px]">
                {formatDuration(selectedService.duration_minutes)}
                {selectedService.price != null ? ` · ₦${selectedService.price.toLocaleString()}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="p-1.5 text-ink-faint hover:text-ink transition-colors"
              aria-label="Previous week"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink-soft">
              {weekDays[0].toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="p-1.5 text-ink-faint hover:text-ink transition-colors"
              aria-label="Next week"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 border-t border-l border-line mb-8">
            {weekDays.map((d) => {
              const ds = toDateStr(d);
              const disabled = ds < today || ds > maxDate;
              const isSelected = ds === selectedDate;
              return (
                <button
                  key={ds}
                  disabled={disabled}
                  onClick={() => pickDate(d)}
                  style={isSelected ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : undefined}
                  className={`relative flex flex-col items-center justify-center gap-1 py-3.5 border-r border-b border-line transition-colors ${
                    disabled
                      ? 'text-ink-faint/40 cursor-not-allowed'
                      : isSelected
                      ? ''
                      : 'text-ink hover:bg-paper'
                  }`}
                >
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] opacity-70">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span className="font-display text-[16px]">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-[17px]">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            {!loadingSlots && <span className="font-mono text-[11.5px] text-ink-faint">{slots.length} open</span>}
          </div>

          {loadingSlots ? (
            <p className="text-ink-faint text-[13.5px] py-6 text-center">Loading…</p>
          ) : slots.length === 0 ? (
            <div className="border border-dashed border-line-strong py-12 flex flex-col items-center text-center px-6">
              <p className="text-ink-soft text-[13.5px]">No openings this day. Try another date above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-8">
              {slots.map((t) => {
                const isSel = t === selectedSlot;
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedSlot(t)}
                    style={isSel ? { background: 'var(--accent)', color: 'var(--accent-contrast)', borderColor: 'var(--accent)' } : undefined}
                    className={`py-2.5 text-[13px] font-mono border rounded-md transition-all ${
                      isSel ? '' : 'border-line-strong bg-surface hover:border-[var(--accent)]'
                    }`}
                  >
                    {new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setStep('details')}
            disabled={!selectedSlot}
            style={selectedSlot ? { background: 'var(--accent)' } : undefined}
            className="w-full py-3 text-[14px] font-semibold text-white rounded-md transition-opacity disabled:opacity-30"
          >
            Continue →
          </button>
        </div>
      )}

      {step === 'details' && selectedService && selectedSlot && (
        <form onSubmit={handleSubmit} className="animate-rise">
          <button
            type="button"
            onClick={() => setStep('datetime')}
            className="flex items-center gap-1 text-[13px] text-ink-faint hover:text-ink mb-6 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M15 6l-6 6 6 6" /></svg>
            Change time
          </button>

          <h2 className="font-display text-[22px] mb-6">Your details</h2>

          <div className="border border-line rounded-md p-4 mb-6 bg-paper">
            {[
              ['Service', selectedService.name],
              [
                'When',
                new Date(selectedSlot).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              ],
              ...(selectedService.price != null
                ? [['Price', `₦${selectedService.price.toLocaleString()}`]]
                : []),
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between py-2 text-[13.5px] border-b border-dashed border-line last:border-0"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint self-center">
                  {k}
                </span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className={labelClass}>Full name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
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
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'saving'}
            style={{ background: 'var(--accent)' }}
            className="w-full py-3 text-[14px] font-semibold text-white rounded-md transition-opacity disabled:opacity-50"
          >
            {status === 'saving' ? 'Confirming…' : 'Confirm booking'}
          </button>

          {status === 'error' && (
            <p className="text-sm text-red-600 mt-3 text-center">Something went wrong. Please try again.</p>
          )}
        </form>
      )}
    </div>
  );
}
