// The single source for how a booking status is named and coloured.
//
// This previously existed as two identical copies, in AdminDashboardBody
// and BookingsList, with a comment in the first claiming it was "reused
// here rather than redefined". That was not true, and two copies of a
// mapping like this drift the moment someone adds a status to one of them.
//
// Colour never carries the meaning on its own: every place these are used
// renders the label alongside the pill, so a status is still readable
// without colour vision.
export const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  pending_payment: 'Awaiting payment',
};

export const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-accent-soft text-accent',
  completed: 'bg-ink-wash text-ink-faint',
  cancelled: 'bg-ink-wash text-ink-faint line-through',
  no_show: 'bg-error-bg text-error',
  pending_payment: 'bg-warning-bg text-warning',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function statusStyle(status: string): string {
  return STATUS_STYLE[status] ?? 'bg-ink-wash text-ink-faint';
}
