'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseContact } from '@/lib/contact';
import { statusLabel, statusStyle } from '@/lib/bookingStatus';
import ConversationPanel from './ConversationPanel';
import ConfirmDialog from './ConfirmDialog';

export type DetailBooking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_telegram_username: string | null;
  start_time: string;
  status: string;
  services: any;
  staff?: any;
};

// The actual content of "here's one booking and what to do about it" -
// who, what, when, contact, and real actions. Originally lived only
// inside NextAppointmentCard (the dashboard's single most-important
// booking); extracted so the same content can also open from clicking
// any row in BookingsList, which previously offered no way to act on a
// booking beyond the contact link and (on mobile only) a 3-button subset.
// Status changes go through the shared /api/bookings/[id]/status route
// (staff-authenticated, scoped to this business), never a direct write.
export default function BookingDetail({
  slug,
  booking,
  onChanged,
}: {
  slug: string;
  booking: DetailBooking;
  /** Called after a status change succeeds, in addition to router.refresh() - lets a modal close itself. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showConversation, setShowConversation] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const { isBotContact, label: contactLabel } = parseContact(
    booking.customer_phone,
    booking.customer_telegram_username,
    booking.customer_email
  );

  const start = new Date(booking.start_time);
  const today = new Date();
  const isToday = start.toDateString() === today.toDateString();
  const isTomorrow = start.toDateString() === new Date(today.getTime() + 86400000).toDateString();
  const dayLabel = isToday
    ? 'Today'
    : isTomorrow
      ? 'Tomorrow'
      : start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const staffName = Array.isArray(booking.staff) ? booking.staff[0]?.name : booking.staff?.name;
  const isUpcoming = booking.status !== 'cancelled' && start.getTime() >= Date.now();

  async function setStatus(next: string) {
    setPending(next);
    setError('');
    try {
      const res = await fetch(`/api/bookings/${booking.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        setPending(null);
        return;
      }
      router.refresh();
      onChanged?.();
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setPending(null);
    }
  }

  function reschedule() {
    const q = `Reschedule ${booking.customer_name}'s ${booking.services?.name ?? 'appointment'} on ${dayLabel} at ${timeLabel}`;
    router.push(`/${slug}/admin/assistant?q=${encodeURIComponent(q)}`);
  }

  function copyManageLink() {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}/manage/${booking.id}`);
    setPending('copied');
    setTimeout(() => setPending(null), 1500);
  }

  return (
    <div>
      {/* The time was 20px - the same size as a customer's name two
          inches below it. That's the actual problem: nothing on this
          card said "this is the one number that matters today" through
          scale, so a shadow tweak elsewhere was never going to read as
          a real hierarchy change. This is a genuinely large, confident
          number now - the kind of size a dashboard gives its one hero
          metric, not a polite label. */}
      <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-caption font-semibold text-ink-faint mb-1.5">Next appointment</div>
          <div className="font-display text-[40px] sm:text-[44px] font-bold text-ink leading-[0.95] tracking-tight">
            {timeLabel}
          </div>
          <div className="text-body-sm text-ink-soft mt-1">{dayLabel}</div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 ${statusStyle(booking.status)}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel(booking.status)}
        </span>
      </div>

      <div className="px-6 pb-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold text-[16px] text-ink">{booking.customer_name}</span>
        <span className="text-ink-faint text-[13px]">·</span>
        <span className="text-body-sm text-ink-soft">
          {booking.services?.name}
          {booking.services?.duration_minutes != null && ` · ${booking.services.duration_minutes} min`}
        </span>
        {staffName && <span className="text-caption text-ink-faint w-full">with {staffName}</span>}
      </div>

      {error && (
        <div className="mx-6 mb-3 rounded-lg bg-error-bg border border-error-border px-3 py-2 text-caption text-error">
          {error}
        </div>
      )}

      {isUpcoming ? (
        <div className="px-6 pb-6 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-4">
          {isBotContact ? (
            <button
              type="button"
              onClick={() => setShowConversation(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 min-h-[36px] text-caption font-semibold text-accent-contrast transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Message {contactLabel}
            </button>
          ) : (
            <a
              href={`tel:${booking.customer_phone}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 min-h-[36px] text-caption font-semibold text-accent-contrast transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Call {contactLabel}
            </a>
          )}

          <button
            type="button"
            onClick={reschedule}
            className="rounded-full border border-line-strong px-3.5 py-2 min-h-[36px] text-caption font-medium text-ink hover:border-accent hover:text-accent transition-colors"
          >
            Reschedule
          </button>

          {booking.status === 'confirmed' && (
            <button
              type="button"
              onClick={() => setStatus('completed')}
              disabled={pending === 'completed'}
              className="rounded-full border border-line-strong px-3.5 py-2 min-h-[36px] text-caption font-medium text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
            >
              {pending === 'completed' ? 'Marking…' : 'Mark completed'}
            </button>
          )}

          {booking.status === 'confirmed' && (
            <button
              type="button"
              onClick={() => setStatus('no_show')}
              disabled={pending === 'no_show'}
              className="rounded-full border border-line-strong px-3.5 py-2 min-h-[36px] text-caption font-medium text-ink-soft hover:border-error hover:text-error transition-colors disabled:opacity-50"
            >
              {pending === 'no_show' ? 'Marking…' : 'No-show'}
            </button>
          )}

          <button
            type="button"
            onClick={copyManageLink}
            className="rounded-full px-3.5 py-2 min-h-[36px] text-caption font-medium text-ink-faint hover:text-ink transition-colors"
          >
            {pending === 'copied' ? 'Link copied' : 'Copy reschedule link'}
          </button>

          {booking.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              disabled={pending === 'cancelled'}
              className="ml-auto rounded-full px-3.5 py-2 min-h-[36px] text-caption font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
            >
              {pending === 'cancelled' ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      ) : (
        // Past, completed, no-show, or cancelled - nothing left to change,
        // but messaging the customer is still meaningful (a completed
        // visit's customer might message about a follow-up).
        <div className="px-6 pb-6 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-4">
          {isBotContact && (
            <button
              type="button"
              onClick={() => setShowConversation(true)}
              className="rounded-full border border-line-strong px-3.5 py-2 min-h-[36px] text-caption font-medium text-ink hover:border-accent hover:text-accent transition-colors"
            >
              Message {contactLabel}
            </button>
          )}
        </div>
      )}

      {showConversation && (
        <ConversationPanel
          slug={slug}
          customerPhone={booking.customer_phone}
          customerLabel={
            booking.customer_telegram_username ? `@${booking.customer_telegram_username}` : booking.customer_name
          }
          onClose={() => setShowConversation(false)}
        />
      )}

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel appointment?"
        message={`Cancel ${booking.customer_name}'s appointment${booking.services?.name ? ` for ${booking.services.name}` : ''}?`}
        confirmLabel="Cancel appointment"
        pendingLabel="Cancelling…"
        cancelLabel="Keep it"
        pending={pending === 'cancelled'}
        onConfirm={() => {
          setConfirmingCancel(false);
          setStatus('cancelled');
        }}
        onCancel={() => setConfirmingCancel(false)}
      />
    </div>
  );
}
