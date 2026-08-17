'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import CalendarPicker from './CalendarPicker';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
};

type Step = 'service' | 'datetime' | 'details' | 'confirmed';
type Period = 'Morning' | 'Afternoon' | 'Evening';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} hr` : `${h} hr ${rest} min`;
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

// A thin progress rule + a plain mono label, not three bold circles with
// glow rings — this page's job is to feel like a considered reservation
// on a business's own site, not a SaaS onboarding wizard. The admin
// dashboard earns its heavier chrome because it's a working tool; a
// customer booking an appointment doesn't need to feel like they're
// filling out a form.
function StepIndicator({ step }: { step: number }) {
  const steps = ['Service', 'Time', 'Details'];
  return (
    <div className="max-w-xs mx-auto mb-10">
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
          Step {step} of 3
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>
          {steps[step - 1]}
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-line overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(step / 3) * 100}%`, background: 'var(--accent)' }}
        />
      </div>
    </div>
  );
}

function ConfirmationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-dashed border-line last:border-0">
      <span className="text-[13px] text-ink-faint">{label}</span>
      <span className="text-[14px] font-semibold text-ink">{value}</span>
    </div>
  );
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('ld-booking-name');
      const savedEmail = localStorage.getItem('ld-booking-email');
      const savedPhone = localStorage.getItem('ld-booking-phone');
      if (savedName) setName(savedName);
      if (savedEmail) setEmail(savedEmail);
      if (savedPhone) setPhone(savedPhone);
    }
  }, []);

  const slotGroups = useMemo(() => groupSlots(slots), [slots]);

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
      if (typeof window !== 'undefined') {
        localStorage.setItem('ld-booking-name', name);
        localStorage.setItem('ld-booking-email', email);
        localStorage.setItem('ld-booking-phone', phone);
      }
      setBookingId(data.booking.id);
      setStatus('idle');
      setStep('confirmed');
    } else {
      setStatus('error');
    }
  }

  const stepNum = step === 'service' ? 1 : step === 'datetime' ? 2 : step === 'details' ? 3 : 4;

  if (step === 'confirmed') {
    return (
      <div className="animate-rise max-w-xl mx-auto">
        <div className="rounded-3xl bg-surface border border-line shadow-[0_20px_50px_-20px_var(--accent-soft)] overflow-hidden">
          <div
            className="px-6 sm:px-8 pt-10 pb-7 text-center"
            style={{ background: 'linear-gradient(160deg, var(--accent-soft), transparent 75%)' }}
          >
            <div
              className="animate-popIn inline-flex items-center justify-center h-16 w-16 rounded-full mb-5 shadow-[0_10px_24px_-6px_var(--accent)]"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="font-display text-[28px] sm:text-[32px] font-bold text-ink">
              You&rsquo;re all set, {name.split(' ')[0]}!
            </h2>
            <p className="text-ink-soft text-[14px] mt-2">A confirmation has been sent to {email}</p>
          </div>

          <div className="px-6 sm:px-8 py-5">
            <ConfirmationRow label="Service" value={selectedService?.name ?? ''} />
            <ConfirmationRow
              label="Date"
              value={
                selectedSlot
                  ? new Date(selectedSlot).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })
                  : ''
              }
            />
            <ConfirmationRow label="Time" value={selectedSlot ? formatTime(selectedSlot) : ''} />
            {selectedService?.price != null && (
              <ConfirmationRow label="Price" value={`₦${selectedService.price.toLocaleString()}`} />
            )}
          </div>

          <div className="mx-6 sm:mx-8 border-t border-dashed border-line" />
          <div className="px-6 sm:px-8 py-5 flex items-center justify-between">
            <span className="text-[12px] text-ink-faint font-medium">Booking code</span>
            <span className="font-mono text-[15px] tracking-[0.2em] font-bold" style={{ color: 'var(--accent)' }}>
              {bookingId.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="text-center mt-5">
          <Link
            href={`/${slug}/manage/${bookingId}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            Manage this booking
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator step={stepNum} />

      {step !== 'service' && selectedService && (
        <div className="max-w-xl mx-auto rounded-2xl bg-warm-surface overflow-hidden mb-6 animate-rise">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[14px] font-semibold text-ink truncate block">{selectedService.name}</span>
              {selectedSlot && (
                <span className="text-[12px] text-ink-faint">
                  {new Date(selectedSlot).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {formatTime(selectedSlot)}
                </span>
              )}
            </div>
            <button
              onClick={() => setStep('service')}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-surface shrink-0"
              style={{ color: 'var(--accent)' }}
            >
              Change
            </button>
          </div>
        </div>
      )}

      {step === 'service' && (
        <div className="animate-rise">
          <h2 className="font-display text-[26px] sm:text-[30px] font-semibold text-ink mb-1.5 text-center">Select a service</h2>
          <p className="text-[14.5px] text-ink-faint mb-8 text-center">Choose what you&apos;d like to book for your visit</p>
          {services.length === 0 ? (
            <div className="max-w-lg mx-auto text-center py-12">
              <p className="text-ink-soft text-[14px]">This business hasn&apos;t listed any services yet.</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto border-y border-line">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectService(s)}
                  className="group w-full flex items-center justify-between gap-4 py-5 px-1 text-left border-b border-line last:border-0 transition-colors hover:bg-warm-surface"
                >
                  <div className="min-w-0">
                    <h3 className="font-display text-[18px] font-semibold text-ink leading-tight">{s.name}</h3>
                    <div className="flex items-center gap-1.5 text-ink-faint mt-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <span className="text-[12.5px]">{formatDuration(s.duration_minutes)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.price != null ? (
                      <span className="font-display text-[17px] font-semibold" style={{ color: 'var(--accent)' }}>
                        ₦{s.price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[12.5px] font-medium text-ink-faint">Ask for pricing</span>
                    )}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-ink-faint group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all shrink-0"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {services.length > 0 && (
            <div className="mt-8 text-center">
              <p className="text-[14px] text-ink-faint">
                Not sure what to pick?{' '}
                <span className="font-semibold underline underline-offset-4" style={{ color: 'var(--accent)' }}>
                  Message us and we&apos;ll help you choose
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {step === 'datetime' && selectedService && (
        <div className="animate-rise max-w-xl mx-auto">
          <h2 className="font-display text-[22px] font-semibold text-ink mb-1 text-center">Pick a time</h2>
          <p className="text-[14px] text-ink-faint mb-6 text-center">Select a date and an available slot</p>

          <div className="rounded-2xl bg-surface border border-line p-4 mb-6">
            <CalendarPicker
              selectedDate={selectedDate}
              onChange={(d) => {
                setSelectedDate(toDateStr(d));
                setSelectedSlot('');
              }}
              today={today}
              maxDate={maxDate}
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-ink">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            {!loadingSlots && (
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint">
                {slots.length} available
              </span>
            )}
          </div>

          {loadingSlots ? (
            <div className="space-y-5 mb-6">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className="h-3 w-20 rounded bg-warm-surface mb-3 animate-shimmer" style={{ backgroundImage: 'linear-gradient(90deg, transparent, var(--line), transparent)', backgroundSize: '200% 100%' }} />
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="w-[76px] h-[36px] rounded-lg bg-warm-surface animate-shimmer" style={{ backgroundImage: 'linear-gradient(90deg, transparent, var(--line), transparent)', backgroundSize: '200% 100%', animationDelay: `${j * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : slotGroups.length === 0 ? (
            <div className="rounded-2xl bg-warm-surface py-10 flex flex-col items-center text-center px-6 mb-6">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-faint mb-3">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <p className="text-ink-soft text-[14px]">No openings on this day</p>
              <p className="text-ink-faint text-[12px] mt-1">Try selecting a different date</p>
            </div>
          ) : (
            <div className="space-y-5 mb-6">
              {slotGroups.map(([period, times]) => (
                <div key={period}>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-2.5">
                    {period}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {times.map((t) => {
                      const isSel = t === selectedSlot;
                      return (
                        <button
                          key={t}
                          onClick={() => setSelectedSlot(t)}
                          style={
                            isSel
                              ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                              : undefined
                          }
                          className={`min-w-[76px] py-2.5 px-3 text-[13px] font-medium tabular-nums border rounded-lg transition-all duration-150 ${
                            isSel
                              ? 'animate-punch border-transparent'
                              : 'border-line-strong bg-surface text-ink hover:border-[var(--accent)] hover:bg-warm-surface active:scale-95'
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

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('service')}
              className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-faint hover:text-ink transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              onClick={() => setStep('details')}
              disabled={!selectedSlot}
              style={selectedSlot ? { background: 'var(--accent)' } : undefined}
              className="px-8 py-3 text-[14px] font-semibold text-white rounded-full transition-all disabled:opacity-25 disabled:bg-line-strong hover:opacity-90 active:scale-[0.98]"
            >
              Continue to details
            </button>
          </div>
        </div>
      )}

      {step === 'details' && selectedService && selectedSlot && (
        <form onSubmit={handleSubmit} className="animate-rise max-w-xl mx-auto">
          <h2 className="font-display text-[22px] font-semibold text-ink mb-1 text-center">Your details</h2>
          <p className="text-[14px] text-ink-faint mb-6 text-center">We&apos;ll send your confirmation here</p>

          <div className="space-y-4 mb-6">
            {[
              { label: 'Full name', value: name, onChange: setName, type: 'text' },
              { label: 'Email', value: email, onChange: setEmail, type: 'email' },
              { label: 'Phone', value: phone, onChange: setPhone, type: 'tel' },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-[13px] font-medium text-ink-soft mb-1.5">{field.label}</label>
                <input
                  required
                  type={field.type}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={status === 'saving'}
            style={{ background: 'var(--accent)' }}
            className="w-full py-3.5 text-[14px] font-semibold text-white rounded-full transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98]"
          >
            {status === 'saving' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                Confirming…
              </span>
            ) : (
              'Confirm booking'
            )}
          </button>

          {status === 'error' && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-error-bg border border-error-border">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
              <p className="text-[13px] text-error">Something went wrong. Please try again.</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
