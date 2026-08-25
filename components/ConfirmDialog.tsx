'use client';

import { useDialog } from './useDialog';

// Replaces the browser's own confirm() - 8 call sites across 7 files used
// it for real destructive actions (cancel a booking, cancel a
// subscription, delete a service/product, remove a staff member,
// disconnect a channel) and got the platform's unstyled, unbrandable,
// main-thread-blocking dialog for every one of them, with none of the
// focus-trap/Escape/dialog-semantics the rest of the app's overlays
// share via useDialog.
//
// Deliberately just a yes/no prompt, not a general-purpose modal - the
// callers that used confirm() only ever needed "are you sure", never a
// form or richer content. `pending` disables both buttons and swaps the
// confirm label, mirroring the disabled-during-request pattern each
// caller already had.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  pendingLabel,
  cancelLabel = 'Cancel',
  danger = true,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Shown on the confirm button while `pending` is true; falls back to `confirmLabel`. */
  pendingLabel?: string;
  cancelLabel?: string;
  /** Nearly every caller is a destructive action - red confirm button by default. */
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useDialog(open, onCancel);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade"
        style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-surface border-2 border-line shadow-card p-5 animate-rise"
      >
        <h2 id="confirm-dialog-title" className="font-display text-[17px] font-semibold text-ink mb-1.5">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="text-body-sm text-ink-soft leading-relaxed">
          {message}
        </p>
        <div className="flex items-center justify-end gap-2.5 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-line-strong px-3.5 py-2 min-h-[36px] text-caption font-medium text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg px-3.5 py-2 min-h-[36px] text-caption font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: danger ? 'var(--error)' : 'var(--accent)', color: danger ? '#fff' : 'var(--accent-contrast)' }}
          >
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
