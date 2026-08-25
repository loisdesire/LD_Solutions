'use client';

import { useDialog } from './useDialog';
import { parseContact } from '@/lib/contact';
import { statusLabel, statusStyle } from '@/lib/bookingStatus';
import { formatMoney } from '@/lib/formatMoney';

type Booking = {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_telegram_username: string | null;
  start_time: string;
  status: string;
  services: any;
};

type Customer = {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  telegramUsername: string | null;
  bookingCount: number;
  totalSpent: number;
  lastVisit: string;
  lastService: string | null;
  nextVisit: string | null;
};

// Rows in the customer list previously opened nothing except the contact
// cell - there was no way to see a customer's actual visit history, only
// the aggregate numbers (count, total spent, last visit) in the row
// itself. This is the closest thing to a "View customer" page: their
// full booking history, drawn from the same `bookings` data the page
// already loaded (no extra fetch), plus a way to reach them.
export default function CustomerDetailModal({
  slug,
  customer,
  bookings,
  onMessage,
  onClose,
}: {
  slug: string;
  customer: Customer;
  /** Every booking belonging to this customer, most recent first. */
  bookings: Booking[];
  onMessage: () => void;
  onClose: () => void;
}) {
  const dialogRef = useDialog(true, onClose);
  const { isBotContact, label: contactLabel } = parseContact(customer.phone ?? customer.email ?? '', customer.telegramUsername);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${customer.name}'s history`}
      ref={dialogRef}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade"
        style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl bg-surface border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] animate-rise">
        <div className="sticky top-0 z-10 flex items-start justify-between px-6 py-4 border-b border-line bg-surface">
          <div className="min-w-0">
            <h2 className="font-display text-[19px] font-semibold text-ink truncate">{customer.name}</h2>
            <p className="text-caption text-ink-faint mt-0.5">{contactLabel}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 pt-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">Visits</div>
            <div className="font-display text-[17px] font-bold text-ink mt-0.5">{customer.bookingCount}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">Total spent</div>
            <div className="font-display text-[17px] font-bold text-ink mt-0.5">
              {customer.totalSpent ? formatMoney(customer.totalSpent) : '-'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">Last visit</div>
            <div className="font-display text-[17px] font-bold text-ink mt-0.5">
              {new Date(customer.lastVisit).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        {isBotContact && (
          <div className="px-6 pt-4">
            <button
              onClick={onMessage}
              className="rounded-full px-4 py-2 min-h-[40px] text-caption font-semibold text-accent-contrast transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Message {contactLabel}
            </button>
          </div>
        )}

        <div className="px-6 pt-4 pb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint mb-2 mt-2">
            Booking history
          </div>
          <div className="border-t border-line">
            {bookings.map((b, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 py-3 ${i !== bookings.length - 1 ? 'border-b border-dashed border-line' : ''}`}
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-ink truncate">{b.services?.name ?? 'Service'}</div>
                  <div className="text-caption text-ink-faint">
                    {new Date(b.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}
                    {new Date(b.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em] shrink-0 ${statusStyle(b.status)}`}
                >
                  {statusLabel(b.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
