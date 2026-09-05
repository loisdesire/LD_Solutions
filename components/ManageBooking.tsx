'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CalendarPicker from './CalendarPicker';
import Skeleton from './Skeleton';
import SlotTimePicker from './SlotTimePicker';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ManageBooking({
  slug,
  bookingId,
  businessId,
  serviceId,
  initialStatus,
  startTime,
  maxAdvanceDays = 30,
  timeZone,
}: {
  slug: string;
  bookingId: string;
  businessId: string;
  serviceId: string;
  initialStatus: string;
  startTime: string;
  maxAdvanceDays?: number;
  /** The business's own IANA zone, passed through to the reschedule
   * picker so its slot times/grouping match the business, not the
   * customer's own device - see SlotTimePicker's own note on this. */
  timeZone?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(toDateStr(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  // Without these, every date change rendered "0 open" and "No openings
  // this day" for the entire duration of the fetch - telling a customer
  // trying to reschedule that the business was full, on every single click.
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  // Forces a refetch of the same date - setDate(d => d) would be a no-op,
  // since React bails out when state is identical.
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [rescheduled, setRescheduled] = useState(false);

  const today = toDateStr(new Date());
  const maxDate = toDateStr(new Date(Date.now() + maxAdvanceDays * 86400000));

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

  // Neither of these had a try/catch at all - the same class of bug
  // BookingForm.tsx's createBooking already had fixed (see its comment):
  // a network failure or a non-JSON error response threw straight out of
  // an async onClick handler, leaving `loading` stuck true and the
  // button reading "Cancelling…"/"Saving…" forever with nothing to tell
  // the customer why.
  async function handleCancel() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setStatus('cancelled');
      // This component's own status pill/copy updates from local state
      // (above), but the page around it - the status badge in the card
      // header, rendered server-side from the original booking prop -
      // has no way to know anything changed. Confirmed live: it kept
      // reading "CONFIRMED" until a manual reload. refresh() re-runs the
      // server component with fresh data without a full page reload.
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReschedule() {
    if (!selectedSlot) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStartTime: selectedSlot }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setRescheduling(false);
      setRescheduled(true);
      // Same reasoning as handleCancel above - the server-rendered date/
      // time in the card header would otherwise still show the old slot
      // until a manual reload.
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Every terminal state (cancelled, or already happened) used to leave
  // the same blank card with nothing to do next - the only way forward
  // was noticing the "Back to {business}" link all the way up in the
  // page header. Each one now offers the actual next step.
  if (status === 'cancelled') {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="font-semibold text-[14px]">This booking has been cancelled.</p>
        <Link
          href={`/${slug}#book`}
          className="inline-flex items-center gap-1.5 mt-4 rounded-full px-5 py-2.5 min-h-[44px] text-[13.5px] font-semibold text-accent-contrast transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          Book a new appointment
        </Link>
      </div>
    );
  }

  // Reschedule/cancel only make sense for something that hasn't happened
  // yet - this used to show both buttons unconditionally, so a booking
  // from last week still looked fully actionable.
  if (new Date(startTime).getTime() < Date.now()) {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="font-semibold text-[14px]">This appointment has already happened.</p>
        <p className="text-ink-soft text-[13px] mt-1">Nothing to manage here anymore.</p>
        <Link
          href={`/${slug}#book`}
          className="inline-flex items-center gap-1.5 mt-4 rounded-full px-5 py-2.5 min-h-[44px] text-[13.5px] font-semibold text-accent-contrast transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          Book again
        </Link>
      </div>
    );
  }

  if (rescheduled) {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="font-semibold text-[14px]">Your booking has been rescheduled.</p>
        <p className="text-ink-soft text-[13px] mt-1">Your new time is confirmed.</p>
      </div>
    );
  }

  if (rescheduling) {
    return (
      <div className="border-2 border-line-strong bg-surface rounded-2xl p-6 space-y-5 animate-rise shadow-soft">
        <div>
          {/* Captions a button-grid calendar, not one input - a <label>
              with nothing for htmlFor to point at is the same
              half-association problem this pass exists to fix. */}
          <span className="font-mono block text-[12px] uppercase tracking-[0.08em] text-ink-faint mb-2">
            New date
          </span>
          <CalendarPicker
            selectedDate={date}
            onChange={(d) => {
              setDate(toDateStr(d));
              setSelectedSlot('');
            }}
            today={today}
            maxDate={maxDate}
            businessId={businessId}
            serviceId={serviceId}
          />
        </div>

        {date && (
          <div className="pt-2 animate-rise">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono block text-[12px] uppercase tracking-[0.08em] text-ink-faint">
                Available times
              </span>
              {!loadingSlots && !slotsError && (
                <span className="font-mono text-[12px] text-ink-faint">{slots.length} open</span>
              )}
            </div>
            {loadingSlots ? (
              <div className="mb-4">
                <Skeleton className="w-full h-[50px] rounded-xl" />
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
              // Same collapsed-trigger/scroll-strip picker as the public
              // booking page and the admin quick-add modal - was the same
              // flat Morning/Afternoon/Evening slot dump both of those
              // used to have. `key={date}` remounts on date change so it
              // resets closed.
              <div className="mb-4">
                <SlotTimePicker key={date} slots={slots} selectedSlot={selectedSlot} onSelect={setSelectedSlot} timeZone={timeZone} />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleReschedule}
            disabled={loading || !selectedSlot}
            style={selectedSlot ? { background: 'var(--accent)' } : undefined}
            className="flex-1 rounded-xl py-3 text-[13.5px] font-semibold text-accent-contrast transition-opacity disabled:opacity-40"
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
