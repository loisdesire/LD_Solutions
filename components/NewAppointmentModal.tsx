'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CalendarPicker from './CalendarPicker';
import { useDialog } from './useDialog';
import Field from './Field';
import { inputClass, labelClass } from './formStyles';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
};

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

// A quick-add flow for staff booking a walk-in or phone customer straight
// from the dashboard - same underlying availability/booking APIs the
// public booking page uses, just collapsed into one modal instead of a
// multi-step wizard, since staff already know what they're booking and
// shouldn't have to click through "steps" to enter it.
export default function NewAppointmentModal({
  businessId,
  services,
  maxAdvanceDays,
  onClose,
}: {
  businessId: string;
  services: Service[];
  maxAdvanceDays: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [date, setDate] = useState(toDateStr(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [done, setDone] = useState(false);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const today = toDateStr(new Date());
  const maxDate = toDateStr(new Date(Date.now() + maxAdvanceDays * 86400000));
  const slotGroups = useMemo(() => groupSlots(slots), [slots]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!serviceId || !date) return;
    setLoadingSlots(true);
    setSelectedSlot('');
    fetch(`/api/availability?businessId=${businessId}&serviceId=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
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
        serviceId: selectedService.id,
        customerName: name,
        customerEmail: email || undefined,
        customerPhone: phone,
        startTime: selectedSlot,
        durationMinutes: selectedService.duration_minutes,
      }),
    });

    if (res.ok) {
      setStatus('idle');
      setDone(true);
      router.refresh();
    } else {
      setStatus('error');
    }
  }

  const dialogRef = useDialog(true, onClose);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="New appointment" ref={dialogRef}>
      <div className="absolute inset-0 backdrop-blur-sm animate-fade" style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }} onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl bg-surface border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] animate-rise">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-line bg-surface">
          <h2 className="font-display text-[19px] font-semibold text-ink">
            {done ? 'Booked!' : 'New appointment'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div
              className="animate-popIn inline-flex items-center justify-center h-14 w-14 rounded-full mb-4"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="font-display text-[18px] font-semibold text-ink">
              {name.split(' ')[0]} is booked for {selectedSlot ? formatTime(selectedSlot) : ''}
            </p>
            <p className="text-ink-soft text-[13.5px] mt-1.5">It's already on the calendar below.</p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => {
                  setDone(false);
                  setName('');
                  setPhone('');
                  setEmail('');
                  setSelectedSlot('');
                }}
                className="rounded-full border-2 border-line-strong px-5 py-2.5 text-[13.5px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors"
              >
                Book another
              </button>
              <button
                onClick={onClose}
                className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent)' }}
              >
                Done
              </button>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-ink-soft text-[14px]">You need at least one service before you can book anyone in - add one on the Services page first.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="mb-5">
              {/* Captions a button-group, not one input. */}
              <span className={labelClass}>Service</span>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const isSel = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      style={isSel ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-contrast)' } : undefined}
                      className={`px-3.5 py-2 text-[13px] font-semibold border-2 rounded-full transition-all ${
                        isSel ? 'shadow-[0_4px_12px_-4px_var(--accent)]' : 'border-line-strong bg-surface hover:border-[var(--accent)]'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5 rounded-2xl bg-paper border-2 border-line p-3.5">
              <CalendarPicker selectedDate={date} onChange={(d) => setDate(toDateStr(d))} today={today} maxDate={maxDate} />
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <span className={labelClass}>Available times</span>
                {!loadingSlots && <span className="font-mono text-[11px] text-ink-faint">{slots.length} open</span>}
              </div>
              {loadingSlots ? (
                <p className="text-ink-faint text-[13px]">Checking availability…</p>
              ) : slotGroups.length === 0 ? (
                <div className="border-2 border-dashed border-line-strong rounded-xl py-6 text-center px-4">
                  <p className="text-ink-soft text-[13px]">No openings this day. Try another date.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {slotGroups.map(([period, times]) => (
                    <div key={period}>
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint mb-2">{period}</div>
                      <div className="flex flex-wrap gap-2">
                        {times.map((t) => {
                          const isSel = t === selectedSlot;
                          return (
                            <button
                              type="button"
                              key={t}
                              onClick={() => setSelectedSlot(t)}
                              style={isSel ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-contrast)' } : undefined}
                              className={`min-w-[76px] py-2 px-3 text-[13px] font-mono font-semibold tabular-nums border-2 rounded-full transition-all active:scale-95 ${
                                isSel ? 'animate-punch shadow-[0_4px_12px_-2px_var(--accent)]' : 'border-line-strong bg-surface hover:border-[var(--accent)] hover:-translate-y-0.5'
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

            <div className="space-y-3.5 mb-5">
              <Field label="Customer name" required>
                {(props) => (
                  <input {...props} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jane Doe" />
                )}
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Phone" required>
                  {(props) => (
                    <input {...props} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="080…" />
                  )}
                </Field>
                <Field label="Email (optional)">
                  {(props) => (
                    <input {...props} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="jane@…" />
                  )}
                </Field>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'saving' || !selectedSlot}
              style={selectedSlot ? { background: 'var(--accent)' } : undefined}
              className="w-full py-3.5 text-[14px] font-semibold text-white rounded-full transition-all disabled:opacity-30 disabled:bg-line-strong hover:opacity-90 active:scale-[0.98]"
            >
              {status === 'saving' ? 'Booking…' : selectedSlot ? `Book for ${formatTime(selectedSlot)}` : 'Pick a time'}
            </button>

            {status === 'error' && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-error-bg border border-error-border">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                <p className="text-[13px] text-error">Something went wrong. Please try again.</p>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
