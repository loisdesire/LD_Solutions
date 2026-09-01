'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import CalendarPicker from './CalendarPicker';
import Skeleton from './Skeleton';
import Field from './Field';
import { googleCalendarUrl } from '@/lib/googleCalendar';
import { formatMoney } from '@/lib/formatMoney';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  description?: string | null;
  image_url?: string | null;
};

type Step = 'service' | 'datetime' | 'details' | 'confirmed';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

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

// Real hour/minute picker instead of a flat list of every slot as its
// own button - a business open 6am-7pm with a short service and a small
// buffer can produce dozens of individual times, and no one wants to
// scan/scroll through a wrapped grid of that many buttons. This groups
// the already-computed, already-availability-checked slots (from
// /api/availability - the same data the old flat list used, so this is
// exactly as constrained by real hours/buffer/existing bookings as
// before) by hour, so the picker only ever has to show "which hours have
// anything open" and then "which minutes within this hour" - the actual
// native time-picker shape, not a fixed 24-hour clock with most of it
// disabled.
function groupSlotsByHour(slots: string[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const s of slots) {
    const h = new Date(s).getHours();
    if (!map.has(h)) map.set(h, []);
    map.get(h)!.push(s);
  }
  return map;
}

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function formatMinuteLabel(iso: string): string {
  return `:${String(new Date(iso).getMinutes()).padStart(2, '0')}`;
}

// A thin progress rule + a plain mono label, not three bold circles with
// glow rings - this page's job is to feel like a considered reservation
// on a business's own site, not a SaaS onboarding wizard. The admin
// dashboard earns its heavier chrome because it's a working tool; a
// customer booking an appointment doesn't need to feel like they're
// filling out a form.
// Labels match the step headings word for word. They used to read
// Service/Time/Details against headings of "What would you like?" etc, so
// the progress bar and the page named the same step differently.
const STEP_LABELS = ['What you want', 'When', 'Your details'];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="max-w-xs mx-auto mb-10">
      {/* The whole flow was silent to screen readers - moving between steps
          changed everything on screen and announced nothing. */}
      <p className="sr-only" role="status" aria-live="polite">
        Step {step} of 3: {STEP_LABELS[step - 1]}
      </p>
      <div className="flex items-center justify-between mb-2.5" aria-hidden="true">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          Step {step} of 3
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>
          {STEP_LABELS[step - 1]}
        </span>
      </div>
      <div
        className="h-[3px] rounded-full bg-line overflow-hidden"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label="Booking progress"
      >
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
      <span className="text-[14px] text-ink-faint">{label}</span>
      <span className="text-[14px] font-semibold text-ink">{value}</span>
    </div>
  );
}

export default function BookingForm({
  businessId,
  slug,
  businessName,
  services,
  maxAdvanceDays,
  requirePayment = false,
  depositPercentage = 100,
  paystackPublicKey,
  timezone,
  cancellationWindowHours = 24,
}: {
  businessId: string;
  slug: string;
  businessName: string;
  services: Service[];
  maxAdvanceDays: number;
  requirePayment?: boolean;
  depositPercentage?: number;
  paystackPublicKey?: string | null;
  timezone?: string;
  cancellationWindowHours?: number;
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
  // The API already returns specific, human-readable messages for every
  // failure ("That time is no longer available", "Too many requests…").
  // They used to be parsed and thrown away in favour of one generic
  // string, which made a 409 actively misleading - "please try again"
  // can never succeed without refetching slots first.
  const [errorMessage, setErrorMessage] = useState('');
  const [bookingId, setBookingId] = useState('');
  // Whether the confirmation email actually sent, not just whether we
  // asked the server to try - the screen used to claim "A confirmation
  // has been sent to {email}" unconditionally, even though sendEmail is
  // fire-and-await but its result was discarded server-side.
  const [emailSent, setEmailSent] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);
  // Distinguishes "this day is genuinely fully booked" from "we couldn't
  // load availability" - before this, a network failure or a 429 rendered
  // as "No openings on this day", telling the customer the business was
  // full when it wasn't.
  const [slotsError, setSlotsError] = useState(false);
  // Which hour's minutes the picker below is currently showing - null
  // until a real hour is resolved (first available hour, or the hour of
  // an already-selected slot when resuming). Not the same thing as
  // selectedSlot itself: tapping an hour shows its minutes immediately
  // without necessarily finalizing a specific one yet.
  const [highlightedHour, setHighlightedHour] = useState<number | null>(null);

  const today = toDateStr(new Date());
  const maxDate = toDateStr(new Date(Date.now() + maxAdvanceDays * 86400000));

  // Only a service with a real price can actually require payment - a
  // service with no price set (price is nullable) has nothing to charge,
  // so this business's toggle can't apply to it no matter what.
  const paymentActive = requirePayment && Boolean(selectedService?.price) && Boolean(paystackPublicKey);
  const amountDue = paymentActive ? Math.round(selectedService!.price! * (depositPercentage / 100)) : 0;

  // A short zone label ("WAT", "GMT+1") rather than the raw IANA string -
  // readable at a glance, and it's the one honest way to answer "is that
  // MY time or theirs" for a customer booking a business in a different
  // timezone from their own device. Falls back to the IANA name itself if
  // the runtime can't resolve an abbreviation for it.
  const tzLabel = useMemo(() => {
    if (!timezone) return null;
    try {
      const part = new Intl.DateTimeFormat(undefined, { timeZone: timezone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName');
      return part?.value ?? timezone;
    } catch {
      return timezone;
    }
  }, [timezone]);

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

  useEffect(() => {
    if (!requirePayment) return;
    if (window.PaystackPop) {
      setPaystackReady(true);
      return;
    }
    if (document.getElementById('paystack-inline-js')) return;
    const script = document.createElement('script');
    script.id = 'paystack-inline-js';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setPaystackReady(true);
    document.body.appendChild(script);
  }, [requirePayment]);

  const hourGroups = useMemo(() => groupSlotsByHour(slots), [slots]);
  const availableHours = useMemo(() => [...hourGroups.keys()].sort((a, b) => a - b), [hourGroups]);
  // The hour actually driving the minute column: the highlighted one if
  // it's still valid for this date's slots, else the hour of an
  // already-selected slot (resuming), else just the first open hour.
  const activeHour =
    highlightedHour != null && hourGroups.has(highlightedHour)
      ? highlightedHour
      : selectedSlot && hourGroups.has(new Date(selectedSlot).getHours())
        ? new Date(selectedSlot).getHours()
        : (availableHours[0] ?? null);
  const minutesForActiveHour = activeHour != null ? (hourGroups.get(activeHour) ?? []) : [];

  // `reloadKey` lets other code force a refetch of the same date - used
  // after a 409, where the slot list on screen is known to be stale.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!selectedService || !selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(false);
    // Clearing here matters: without it a failed fetch left the PREVIOUS
    // date's slots on screen, so the customer could pick a time that was
    // never offered for the date they're actually looking at.
    setSlots([]);
    fetch(`/api/availability?businessId=${businessId}&serviceId=${selectedService.id}&date=${selectedDate}`)
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
  }, [selectedService, selectedDate, businessId, reloadKey]);

  function selectService(s: Service) {
    setSelectedService(s);
    setSelectedSlot('');
    setStep('datetime');
  }

  // `paymentTaken` changes what a failure means. Payment happens BEFORE
  // the booking row exists, so if this call fails after a successful
  // charge the customer has paid for nothing - they must be told that
  // plainly rather than shown a generic "try again" that would risk a
  // second charge.
  const PAYMENT_TAKEN_FAILURE =
    "Your payment went through, but we couldn't finish creating the booking. Please contact the business directly with your payment reference - do not pay again.";

  async function createBooking(paymentReference?: string) {
    const paymentTaken = Boolean(paymentReference);
    // Trimmed here, once, rather than on every keystroke - a name typed
    // as " Amaka" (leading space) used to survive `required` (it isn't
    // empty) and then broke the confirmation screen's greeting, since
    // " Amaka".split(' ')[0] is '', not 'Amaka'.
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          serviceId: selectedService!.id,
          customerName: trimmedName,
          customerEmail: trimmedEmail,
          customerPhone: trimmedPhone,
          startTime: selectedSlot,
          durationMinutes: selectedService!.duration_minutes,
          paymentReference,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.booking?.id) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ld-booking-name', trimmedName);
          localStorage.setItem('ld-booking-email', trimmedEmail);
          localStorage.setItem('ld-booking-phone', trimmedPhone);
        }
        setName(trimmedName);
        setBookingId(data.booking.id);
        setEmailSent(Boolean(data.emailSent));
        setErrorMessage('');
        setStatus('idle');
        setStep('confirmed');
        return;
      }

      if (paymentTaken) {
        setErrorMessage(PAYMENT_TAKEN_FAILURE);
        setStatus('error');
        return;
      }

      // 409 = the slot was taken while they were filling in details.
      // Retrying the same slot can never succeed, so send them back to
      // pick a new time with a freshly-loaded list rather than letting
      // them hammer a dead submit button.
      if (res.status === 409) {
        setErrorMessage(data?.error ?? 'That time was just taken. Please choose another.');
        setSelectedSlot('');
        setReloadKey((k) => k + 1);
        setStatus('error');
        setStep('datetime');
        return;
      }

      setErrorMessage(data?.error ?? 'Something went wrong. Please try again.');
      setStatus('error');
    } catch {
      // Network failure or non-JSON response. Previously this threw out
      // of an un-awaited async call, leaving the button stuck on
      // "Confirming…" forever with no message at all.
      setErrorMessage(
        paymentTaken ? PAYMENT_TAKEN_FAILURE : "We couldn't reach the server. Please check your connection and try again."
      );
      setStatus('error');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setStatus('saving');

    // Payment happens before the booking exists at all - the popup asks
    // for money first, and only a genuinely successful charge (verified
    // again server-side, not just trusted from the client callback) ever
    // creates the booking. A cancelled/failed payment just returns to the
    // form with nothing booked and nothing charged.
    if (paymentActive) {
      if (!window.PaystackPop) {
        setErrorMessage(
          "The payment window couldn't load. Check your connection (or any ad blocker) and try again. Nothing has been charged."
        );
        setStatus('error');
        return;
      }
      window.PaystackPop.setup({
        key: paystackPublicKey,
        email: email || 'customer@example.com',
        amount: amountDue * 100, // kobo
        currency: 'NGN',
        metadata: { businessId, serviceId: selectedService.id, customerName: name },
        // A non-async callback calling an async function: any rejection
        // here is unhandled and silently strands a PAID customer with a
        // spinning button. createBooking now handles its own failures,
        // and this .catch is the belt-and-braces backstop.
        callback: (response: { reference: string }) => {
          createBooking(response.reference).catch(() => {
            setErrorMessage(PAYMENT_TAKEN_FAILURE);
            setStatus('error');
          });
        },
        onClose: () => {
          setStatus('idle');
        },
      }).openIframe();
      return;
    }

    await createBooking();
  }

  const stepNum = step === 'service' ? 1 : step === 'datetime' ? 2 : step === 'details' ? 3 : 4;

  if (step === 'confirmed') {
    return (
      <div className="animate-rise max-w-xl mx-auto px-0 sm:px-0">
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
            <p className="text-ink-soft text-[14px] mt-2">
              {emailSent
                ? `A confirmation has been sent to ${email}`
                : 'Save your booking code below - your confirmation email may take a moment, or not arrive at all.'}
            </p>
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
            {paymentActive ? (
              <>
                <ConfirmationRow label="Paid now" value={formatMoney(amountDue)} />
                {depositPercentage < 100 && selectedService?.price != null && (
                  <ConfirmationRow
                    label="Balance due at your visit"
                    value={formatMoney(selectedService.price - amountDue)}
                  />
                )}
              </>
            ) : (
              selectedService?.price != null && (
                <ConfirmationRow label="Price" value={formatMoney(selectedService.price)} />
              )
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

        {/* Was a single ~20px-tall text link. Someone who has just booked
            wants to save it or return to the business - neither was offered. */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 px-2 sm:px-0">
          {selectedService && selectedSlot && (
            <a
              href={googleCalendarUrl({
                title: `${selectedService.name} at ${businessName}`,
                startISO: selectedSlot,
                minutes: selectedService.duration_minutes,
                details: `Booking code ${bookingId.slice(0, 8).toUpperCase()}`,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 min-h-[44px] rounded-full border-2 border-line-strong text-[13.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
              </svg>
              Add to calendar
            </a>
          )}
          <Link
            href={`/${slug}/manage/${bookingId}`}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-3 min-h-[44px] rounded-full text-[13.5px] font-semibold text-accent-contrast transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Manage this booking
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="text-center mt-4">
          <Link href={`/${slug}`} className="text-[13px] text-ink-faint hover:text-ink transition-colors">
            Back to {businessName}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator step={stepNum} />

      {step !== 'service' && selectedService && (
        // Sticky, not just present - the calendar and slot list below can
        // run taller than the viewport, and this is the one thing that
        // should never scroll out of view while money and a time slot are
        // both in play. `top-16` clears the site's own sticky header
        // (SiteHeader.tsx) rather than sitting underneath it; z-30 keeps it
        // below that header's z-50 so the two never fight for a corner.
        <div className="sticky top-16 z-30 max-w-xl mx-auto rounded-2xl bg-warm-surface overflow-hidden mb-6 animate-rise shadow-soft">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            {/* Was up to five stacked lines (name, duration+price, date+
                time, timezone wrapping onto its own line on a narrow phone,
                then a separate deposit line) - a real "info overload"
                complaint, not just a lot of content. Down to three: name, a
                single date+time+duration meta line, and one payment line
                that states the deposit against the total directly instead
                of two separate amounts a customer had to mentally connect
                themselves. Timezone dropped from here - it's already
                disclosed once, up front, in the datetime step's own
                heading area; repeating it on every step after that was
                what caused the wrap in the first place. */}
            <div className="min-w-0">
              <span className="text-[14px] font-semibold text-ink truncate block">{selectedService.name}</span>
              {selectedSlot && (
                <div className="text-[12.5px] text-ink-faint mt-0.5">
                  {new Date(selectedSlot).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {formatTime(selectedSlot)}
                  {' · '}
                  {formatDuration(selectedService.duration_minutes)}
                </div>
              )}
              {selectedService.price != null && (
                <span className="text-[12.5px] font-semibold block mt-0.5" style={{ color: 'var(--accent)' }}>
                  {paymentActive
                    ? depositPercentage < 100
                      ? `Deposit ${formatMoney(amountDue)} of ${formatMoney(selectedService.price)}`
                      : `Due ${formatMoney(amountDue)}`
                    : formatMoney(selectedService.price)}
                </span>
              )}
            </div>
            {/* Was a single "Change" that always jumped to step 1 and cleared
                the chosen slot - so a customer on step 3 who only wanted a
                different time had to re-pick the service too. */}
            <div className="flex items-center gap-1 shrink-0">
              {step === 'details' && (
                <button
                  type="button"
                  onClick={() => setStep('datetime')}
                  className="text-[12.5px] font-semibold px-3 py-2 rounded-lg transition-colors hover:bg-surface min-h-[40px]"
                  style={{ color: 'var(--accent)' }}
                >
                  Change time
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep('service')}
                className="text-[12.5px] font-semibold px-3 py-2 rounded-lg transition-colors hover:bg-surface min-h-[40px]"
                style={{ color: 'var(--accent)' }}
              >
                Change service
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'service' && (
        <div className="animate-rise">
          <h2 className="font-display text-[28px] sm:text-[34px] font-semibold text-ink mb-1.5 text-center tracking-[-0.01em]">What would you like?</h2>
          <p className="text-[14.5px] text-ink-faint mb-6 sm:mb-8 text-center">Choose what you&apos;d like to book for your visit</p>
          {services.length === 0 ? (
            <div className="max-w-lg mx-auto text-center py-12">
              <p className="text-ink-soft text-[14px]">No services are listed yet. If you know what you need, ask in the chat. We can still help.</p>
            </div>
          ) : (
            // Card grid, not the flat menu this used to be - services can
            // carry a real photo now, and a photo sitting at 56px in a row
            // undersold it. A service with no image gets an icon tile
            // instead of a blank space, so the grid stays even without
            // forcing a fake photo where a business hasn't added one.
            // Wider than steps 2/3 (max-w-3xl vs max-w-xl) on purpose now -
            // two cards in a 576px column read as cramped on an actual
            // desktop screen with room to spare. This does reintroduce a
            // width change between steps (the thing max-w-xl was
            // originally set to avoid), but narrowing from a grid into a
            // single-column form as you progress reads as normal
            // convergence, not the jarring "page suddenly got wider"
            // regression that comment was guarding against.
            <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectService(s)}
                  className="group text-left rounded-2xl border border-line-strong bg-surface overflow-hidden transition-all hover:border-[var(--accent)] hover:shadow-[0_16px_32px_-16px_var(--accent-soft)] hover:-translate-y-0.5"
                >
                  {s.image_url ? (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-warm-surface">
                      <img
                        src={s.image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div
                      className="aspect-[4/3] w-full flex items-center justify-center"
                      style={{ background: 'var(--accent-soft)' }}
                    >
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M3 9.5H21" />
                        <path d="M8 3V6.5M16 3V6.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-display text-[17px] font-semibold text-ink leading-tight mb-1">{s.name}</h3>
                    {s.description && (
                      <p className="text-[12.5px] text-ink-faint line-clamp-2 mb-2 leading-snug">{s.description}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="flex items-center gap-1.5 text-ink-faint shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        <span className="text-[12px]">{formatDuration(s.duration_minutes)}</span>
                      </span>
                      {s.price != null ? (
                        <span className="font-display text-[15px] font-semibold" style={{ color: 'var(--accent)' }}>
                          {formatMoney(s.price)}
                        </span>
                      ) : (
                        <span className="text-[11.5px] font-medium text-ink-faint">Ask for pricing</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {services.length > 0 && (
            <div className="mt-8 text-center">
              <p className="text-[14px] text-ink-faint">
                Not sure what to pick?{' '}
                {/* Was a <span> styled to look exactly like a link but
                    doing nothing - not focusable, not clickable. The chat
                    widget already opens on the #chat hash (see
                    WebChatWidget's hashchange listener), which is what the
                    hero's "Chat with us" button uses too. */}
                <a
                  href="#chat"
                  className="font-semibold underline underline-offset-4 rounded"
                  style={{ color: 'var(--accent)' }}
                >
                  Message us and we&apos;ll help you choose
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {step === 'datetime' && selectedService && (
        <div className="animate-rise max-w-xl mx-auto">
          <h2 className="font-display text-[28px] sm:text-[34px] font-semibold text-ink mb-1.5 text-center tracking-[-0.01em]">When works for you?</h2>
          <p className={`text-[14px] text-ink-faint text-center ${tzLabel ? 'mb-1' : 'mb-6'}`}>Select a date and an available slot</p>
          {tzLabel && (
            <p className="text-[13px] text-ink-faint mb-6 text-center">Times shown in {businessName}&rsquo;s timezone ({tzLabel})</p>
          )}

          {/* A 409 (slot taken while they were filling in details) sends
              them back here - without this banner they'd arrive with no
              idea why, and their selected time silently cleared. */}
          {status === 'error' && errorMessage && (
            <div role="alert" className="flex items-start gap-2 mb-5 px-3 py-2 rounded-lg bg-error-bg border border-error-border">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
              <p className="text-[13px] text-error">{errorMessage}</p>
            </div>
          )}

          <div className="rounded-2xl bg-surface border border-line shadow-soft p-4 sm:p-5 mb-6">
            <CalendarPicker
              selectedDate={selectedDate}
              onChange={(d) => {
                setSelectedDate(toDateStr(d));
                setSelectedSlot('');
                setHighlightedHour(null);
              }}
              today={today}
              maxDate={maxDate}
              businessId={businessId}
              serviceId={selectedService.id}
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              {!loadingSlots && !slotsError && slots.length > 0 && (
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint">
                  {slots.length} open
                </span>
              )}
            </div>
            {/* The actual bookable window for the day, not just a count -
                asked for directly: "the user already sees the time window
                for the day... if they don't, add it, so they can just
                select the time they want". First slot to last slot,
                derived from the same already-availability-checked list
                the picker below uses, so it's exactly as accurate as what
                you can actually pick. */}
            {!loadingSlots && !slotsError && slots.length > 0 && (
              <p className="text-[12.5px] text-ink-faint mt-0.5">
                Available {formatTime(slots[0])} &ndash; {formatTime(slots[slots.length - 1])}
              </p>
            )}
          </div>

          {loadingSlots ? (
            // Matches the two-column hour/minute shape below, not the old
            // wrapped-pill rows - a skeleton that doesn't resemble what's
            // about to load in reads as a glitch for a beat.
            <div className="mb-6 flex justify-center gap-3">
              {[0, 1].map((col) => (
                <div key={col} className="w-[108px]">
                  <Skeleton className="h-3 w-10 rounded mb-2 mx-auto" />
                  <div className="h-[216px] rounded-xl border border-line-strong bg-surface p-1.5 space-y-1">
                    {[0, 1, 2, 3, 4].map((row) => (
                      <Skeleton key={row} className="w-full h-9 rounded-lg" delay={(col * 5 + row) * 0.08} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : slotsError ? (
            // Deliberately NOT the "no openings" state - telling someone a
            // business is fully booked when we simply failed to load is a
            // lie that costs the business a booking.
            <div className="rounded-2xl bg-warm-surface py-10 flex flex-col items-center text-center px-6 mb-6">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-faint mb-3">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
              <p className="text-ink-soft text-[14px]">We couldn&rsquo;t load available times</p>
              <p className="text-ink-faint text-[13px] mt-1 mb-4">This is us, not you. The times may still be free.</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="rounded-full border-2 border-line-strong px-5 py-2 text-[13px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors"
              >
                Try again
              </button>
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl bg-warm-surface py-10 flex flex-col items-center text-center px-6 mb-6">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-faint mb-3">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <p className="text-ink-soft text-[14px]">No openings on this day</p>
              <p className="text-ink-faint text-[13px] mt-1">Try selecting a different date</p>
            </div>
          ) : (
            // Real hour/minute picker - was a flat wrapped grid of every
            // individual slot as its own button, which a business open
            // long hours with a short service and small buffer could turn
            // into dozens at once. Pick an hour (only hours with at least
            // one real opening are shown at all - not a plain 12-hour
            // clock with most of it disabled), then a minute within it
            // (same constraint: only minutes /api/availability actually
            // returned for that hour, so buffer time and existing
            // bookings are already excluded before you ever see them).
            // Tapping an hour alone already selects its first open minute,
            // so one tap is a complete, valid choice; the minute column
            // lets you refine it.
            <div className="mb-6">
              <div className="flex justify-center gap-3">
                <div className="w-[108px]">
                  <div className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mb-2">
                    Hour
                  </div>
                  <div className="h-[216px] overflow-y-auto rounded-xl border border-line-strong bg-surface p-1.5 snap-y snap-mandatory scroll-smooth">
                    <div className="space-y-1">
                      {availableHours.map((h) => {
                        const isActive = h === activeHour;
                        return (
                          <button
                            key={h}
                            type="button"
                            ref={(el) => {
                              if (isActive) el?.scrollIntoView({ block: 'center' });
                            }}
                            onClick={() => {
                              setHighlightedHour(h);
                              const firstInHour = hourGroups.get(h)?.[0];
                              if (firstInHour) {
                                setSelectedSlot(firstInHour);
                                if (status === 'error') {
                                  setStatus('idle');
                                  setErrorMessage('');
                                }
                              }
                            }}
                            className="w-full py-2.5 rounded-lg text-[14px] font-semibold tabular-nums snap-center transition-colors"
                            style={
                              isActive
                                ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                                : { color: 'var(--ink)' }
                            }
                          >
                            {formatHourLabel(h)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="w-[108px]">
                  <div className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mb-2">
                    Minute
                  </div>
                  <div className="h-[216px] overflow-y-auto rounded-xl border border-line-strong bg-surface p-1.5 snap-y snap-mandatory scroll-smooth">
                    <div className="space-y-1">
                      {minutesForActiveHour.map((t) => {
                        const isSel = t === selectedSlot;
                        return (
                          <button
                            key={t}
                            type="button"
                            ref={(el) => {
                              if (isSel) el?.scrollIntoView({ block: 'center' });
                            }}
                            onClick={() => {
                              setSelectedSlot(t);
                              if (status === 'error') {
                                setStatus('idle');
                                setErrorMessage('');
                              }
                            }}
                            className={`w-full py-2.5 rounded-lg text-[14px] font-semibold tabular-nums snap-center transition-all ${
                              isSel ? 'animate-punch' : ''
                            }`}
                            style={
                              isSel
                                ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                                : { color: 'var(--ink)' }
                            }
                          >
                            {formatMinuteLabel(t)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {selectedSlot && (
                <p className="text-center text-[13.5px] font-semibold mt-3" style={{ color: 'var(--accent)' }}>
                  {formatTime(selectedSlot)} selected
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('service')}
              className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              onClick={() => setStep('details')}
              disabled={!selectedSlot}
              style={selectedSlot ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : { background: 'var(--line)', color: 'var(--ink-faint)' }}
              className="px-8 py-3 min-h-[44px] text-[14px] font-semibold rounded-full transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed"
            >
              Continue to details
            </button>
          </div>
        </div>
      )}

      {step === 'details' && selectedService && selectedSlot && (
        <form onSubmit={handleSubmit} className="animate-rise max-w-xl mx-auto">
          <h2 className="font-display text-[28px] sm:text-[34px] font-semibold text-ink mb-1.5 text-center tracking-[-0.01em]">Almost there</h2>
          <p className="text-[14px] text-ink-faint mb-6 text-center">We&apos;ll send your confirmation here</p>

          <div className="space-y-4 mb-6">
            {/* Field gives each input a real htmlFor/id pair - the label
                and input here were only ever visually adjacent, so a
                screen reader announced the control unnamed and clicking
                the label text did nothing. autoComplete/inputMode are
                new too: without them this was a plain-text keyboard on
                every field on mobile (no @ row for email, no numeric pad
                for phone) and no browser autofill offer at all. */}
            <Field label="Full name" required>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              )}
            </Field>
            <Field label="Email" required>
              {(props) => (
                <input
                  {...props}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              )}
            </Field>
            <Field label="Phone" required>
              {(props) => (
                <input
                  {...props}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              )}
            </Field>
          </div>

          {/* Was three separate blocks of prose stacked right before the
              pay button (a summary sentence, the deposit box, then a
              cancellation-policy paragraph) - "too much text" right at the
              money moment, and the summary sentence was fully redundant
              with the sticky bar above (which shows the same service, date,
              time and price, and is genuinely sticky - it never scrolls out
              of view, the case that sentence was written to cover). Down to
              one block: the amount, and everything else folded into a
              single tightened caption underneath it. */}
          {paymentActive && (
            <div className="rounded-2xl bg-warm-surface p-4 mb-6">
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="text-ink-soft">
                  {depositPercentage < 100 ? `Deposit (${depositPercentage}%) to confirm` : 'Due to confirm'}
                </span>
                <span className="font-display font-bold text-[17px]" style={{ color: 'var(--accent)' }}>
                  {formatMoney(amountDue)}
                </span>
              </div>
              {/* Trimmed further - "(card or bank transfer)" was detail
                  Paystack's own checkout screen already shows a breath
                  later; cutting it left room for the balance and
                  cancellation facts to read as two short sentences
                  instead of one that ran on. */}
              <p className="text-ink-faint text-[13px] mt-1.5 leading-relaxed">
                Paid via Paystack.
                {depositPercentage < 100 && selectedService.price != null && (
                  <> {formatMoney(selectedService.price - amountDue)} due at your visit.</>
                )}
                {' '}Free to cancel up to {cancellationWindowHours} hour
                {cancellationWindowHours === 1 ? '' : 's'} before.
              </p>
            </div>
          )}

          {/* No payment in play here, so there's no box for a cancellation
              note to live inside - still worth the one line on its own,
              just without the deposit/Paystack text that only applies when
              money's actually moving. */}
          {!paymentActive && (
            <p className="text-ink-faint text-[13px] text-center mb-6 leading-relaxed">
              Free to cancel or reschedule up to {cancellationWindowHours} hour
              {cancellationWindowHours === 1 ? '' : 's'} before your appointment.
            </p>
          )}

          <button
            type="button"
            onClick={() => setStep('datetime')}
            className="w-full mb-2.5 py-3 text-[13.5px] font-medium text-ink-soft rounded-full border-2 border-line-strong transition-colors hover:border-accent hover:text-accent"
          >
            Back to times
          </button>

          <button
            type="submit"
            disabled={status === 'saving' || (paymentActive && !paystackReady)}
            style={{ background: 'var(--accent)' }}
            className="w-full py-3.5 text-[14px] font-semibold text-accent-contrast rounded-full transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98]"
          >
            {status === 'saving' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                Confirming…
              </span>
            ) : paymentActive ? (
              `Pay ${formatMoney(amountDue)} & confirm`
            ) : (
              'Confirm booking'
            )}
          </button>

          {status === 'error' && (
            <div role="alert" className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-error-bg border border-error-border">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
              <p className="text-[13px] text-error">{errorMessage || 'Something went wrong. Please try again.'}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
