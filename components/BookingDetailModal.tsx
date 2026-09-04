'use client';

import { useDialog } from './useDialog';
import BookingDetail, { type DetailBooking } from './BookingDetail';

// The booking rows in BookingsList used to offer no way to act on a
// booking beyond the contact link - clicking the row itself did nothing.
// This is what "the row is clickable" actually means: the same detail +
// actions NextAppointmentCard gives the single next booking, available
// for any row in the list.
export default function BookingDetailModal({
  slug,
  booking,
  onClose,
}: {
  slug: string;
  booking: DetailBooking;
  onClose: () => void;
}) {
  const dialogRef = useDialog(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Booking details"
      ref={dialogRef}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade"
        style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
        onClick={onClose}
      />
      {/* overscroll-contain - same fix as the chat panels: without it,
          scrolling this modal to its own top/bottom hands the rest of the
          scroll to the page underneath instead of just stopping at the
          modal's edge. */}
      <div className="relative w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain rounded-3xl bg-surface border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] animate-rise">
        <div className="sticky top-0 z-10 flex justify-end px-3 pt-3 bg-surface">
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="-mt-8">
          <BookingDetail slug={slug} booking={booking} onChanged={onClose} />
        </div>
      </div>
    </div>
  );
}
