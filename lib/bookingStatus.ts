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

// confirmed is green now, not the brand accent - matches the Stitch
// design's own status treatment (green = confirmed everywhere it shows a
// status, table and calendar alike) and the tinted calendar blocks in
// CalendarView. The accent is a primary-action colour; a booking being
// confirmed is a semantic state, so it takes a semantic colour. completed
// stays a calm neutral - it's history, not something that needs the eye,
// and keeping it green would make it indistinguishable from confirmed;
// cancelled stays neutral+struck since "void" is inactive, not bad;
// no_show is the genuinely-bad one (error), pending_payment the
// needs-attention one (warning).
export const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-success-bg text-success',
  completed: 'bg-ink-wash text-ink-soft',
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
