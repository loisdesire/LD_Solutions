'use client';

import { useMemo, useState } from 'react';
import ConversationPanel from './ConversationPanel';
import CustomerDetailModal from './CustomerDetailModal';
import PillTabs from './PillTabs';
import { parseContact } from '@/lib/contact';
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

function relativeDay(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const days = Math.round((date.getTime() - now.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Same identifier logic as parseContact relies on - customer_phone is
// already an opaque per-channel id (a real phone number for a direct
// web booking, `whatsapp:<number>` / `telegram:<chatId>` for a bot
// conversation), so it's the most reliable thing to group by. Falls
// back to email, then name, only when phone is genuinely missing.
function customerKey(b: Booking): string {
  return b.customer_phone || b.customer_email || b.customer_name;
}

function aggregate(bookings: Booking[]): Customer[] {
  const map = new Map<string, Customer>();
  const now = Date.now();

  for (const b of bookings) {
    const key = customerKey(b);
    const spent = b.status === 'cancelled' ? 0 : (b.services?.price ?? 0);
    // Upcoming, not just "in the future" - a cancelled booking three days
    // from now isn't a real next appointment.
    const isUpcoming = b.status !== 'cancelled' && new Date(b.start_time).getTime() >= now;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        name: b.customer_name,
        phone: b.customer_phone,
        email: b.customer_email,
        telegramUsername: b.customer_telegram_username,
        bookingCount: 1,
        totalSpent: spent,
        lastVisit: b.start_time,
        lastService: b.services?.name ?? null,
        nextVisit: isUpcoming ? b.start_time : null,
      });
      continue;
    }

    existing.bookingCount += 1;
    existing.totalSpent += spent;
    // Bookings arrive sorted ascending by start_time, so the last one
    // processed for a given customer is genuinely their most recent -
    // that's what should win for display name and "last visit".
    if (new Date(b.start_time) >= new Date(existing.lastVisit)) {
      existing.lastVisit = b.start_time;
      existing.lastService = b.services?.name ?? null;
      existing.name = b.customer_name;
    }
    // Earliest upcoming booking wins for "next visit" - ascending order
    // means the first upcoming one seen is already the soonest.
    if (isUpcoming && existing.nextVisit === null) {
      existing.nextVisit = b.start_time;
    }
  }

  return [...map.values()].sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
}

export default function CustomersManager({ slug, bookings }: { slug: string; bookings: Booking[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'frequent' | 'spent'>('recent');
  const [openConversation, setOpenConversation] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  const customers = useMemo(() => aggregate(bookings), [bookings]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query ? customers.filter((c) => c.name.toLowerCase().includes(query)) : customers;
    const sorted = [...base];
    if (sort === 'frequent') sorted.sort((a, b) => b.bookingCount - a.bookingCount);
    else if (sort === 'spent') sorted.sort((a, b) => b.totalSpent - a.totalSpent);
    else sorted.sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
    return sorted;
  }, [customers, search, sort]);

  if (customers.length === 0) {
    return (
      <div className="border-2 border-dashed border-line-strong rounded-3xl p-10 text-center sm:p-14">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="font-display text-[20px]">No customers yet</h2>
        <p className="text-ink-soft text-body-sm mt-1.5 max-w-sm mx-auto">
          The moment someone books, they'll show up here - with every visit and how much they've
          spent, not just the one appointment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 bg-surface border-2 border-line rounded-full px-4 py-2.5 w-full sm:w-80 transition-colors focus-within:border-[var(--accent)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search customers"
            placeholder="Search customers…"
            className="bg-transparent border-none outline-none focus:outline-none rounded-lg px-1 -mx-1 text-body-sm text-ink placeholder-ink-faint w-full"
          />
        </div>
        <PillTabs<'recent' | 'frequent' | 'spent'>
          active={sort}
          onChange={setSort}
          options={[
            { key: 'recent', label: 'Recent' },
            { key: 'frequent', label: 'Most visits' },
            { key: 'spent', label: 'Top spenders' },
          ]}
        />
      </div>

      {/* border-line-strong, not border-line - this table has no card
          wrapper of its own, so these dividers sit directly on the admin
          canvas. border-line (#e7e2da) is now nearly the same lightness
          as --admin-canvas (#e9e3d8) on desktop and reads as no divider
          at all; border-line-strong is the token the app already reaches
          for whenever a border needs to read against a tinted surface. */}
      <div className="border-t-2 border-line-strong">
        <div className="hidden sm:grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_1fr] gap-4 px-2 py-2.5 border-b border-line-strong font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">
          <div>Customer</div>
          <div>Contact</div>
          <div>Visits</div>
          <div>Total spent</div>
          <div>Last visit</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-2 py-10 text-center text-body-sm text-ink-faint">No customers match that search.</div>
        ) : (
          filtered.map((c, i) => {
            const { isBotContact, label } = parseContact(c.phone ?? c.email ?? '', c.telegramUsername);
            return (
              <div
                key={c.key}
                // Clickable now - previously only the contact cell did
                // anything; there was no way to see a customer's actual
                // visit history, just the aggregate row.
                role="button"
                tabIndex={0}
                onClick={() => setDetailCustomer(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailCustomer(c);
                  }
                }}
                className={`cursor-pointer px-2 py-4 hover:bg-warm-surface transition-colors ${
                  i !== filtered.length - 1 ? 'border-b border-line-strong' : ''
                }`}
              >
                <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_1fr] sm:gap-4 sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px] truncate">{c.name}</p>
                      {/* Whether they're coming back was previously
                          invisible - only "last visit" was tracked, so a
                          returning customer with something already on the
                          calendar looked identical to one who might never
                          come back. */}
                      {c.nextVisit && (
                        <span
                          className="font-mono text-[11.5px] uppercase tracking-[0.04em] rounded-full px-2 py-0.5 shrink-0"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                        >
                          Next {relativeDay(c.nextVisit)}
                        </span>
                      )}
                    </div>
                    {c.lastService && (
                      <p className="font-mono text-[12px] uppercase tracking-[0.05em] text-ink-faint truncate mt-0.5">
                        Last booked {c.lastService}
                      </p>
                    )}
                  </div>
                  <div className="font-mono text-[13px] truncate">
                    {c.phone || c.telegramUsername ? (
                      isBotContact ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenConversation(c);
                          }}
                          className="text-accent hover:underline text-left"
                        >
                          {label}
                        </button>
                      ) : (
                        <a href={`tel:${c.phone}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                          {label}
                        </a>
                      )
                    ) : c.email ? (
                      <a href={`mailto:${c.email}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-ink-faint">-</span>
                    )}
                  </div>
                  {/* One compact meta line on mobile instead of three
                      separate stacked blocks - matches how BookingsList
                      groups related fields on a single row instead of
                      stacking every grid column individually. */}
                  <div className="font-mono text-label text-ink-faint sm:hidden">
                    {c.bookingCount} {c.bookingCount === 1 ? 'visit' : 'visits'}
                    {c.totalSpent ? ` · ${formatMoney(c.totalSpent)}` : ''}
                    {' · '}{relativeDay(c.lastVisit)}
                  </div>
                  <div className="hidden sm:block text-body-sm text-ink-soft">
                    {c.bookingCount} {c.bookingCount === 1 ? 'visit' : 'visits'}
                  </div>
                  <div className="hidden sm:block font-mono text-body-sm font-semibold" style={{ color: 'var(--accent)' }}>
                    {c.totalSpent ? formatMoney(c.totalSpent) : '-'}
                  </div>
                  <div className="hidden sm:block text-[13px] text-ink-soft">{relativeDay(c.lastVisit)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {openConversation && (openConversation.phone || openConversation.telegramUsername) && (
        <ConversationPanel
          slug={slug}
          customerPhone={openConversation.phone ?? ''}
          customerLabel={
            openConversation.telegramUsername ? `@${openConversation.telegramUsername}` : openConversation.name
          }
          onClose={() => setOpenConversation(null)}
        />
      )}

      {detailCustomer && (
        <CustomerDetailModal
          slug={slug}
          customer={detailCustomer}
          bookings={bookings
            .filter((b) => customerKey(b) === detailCustomer.key)
            .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())}
          onMessage={() => {
            setOpenConversation(detailCustomer);
            setDetailCustomer(null);
          }}
          onClose={() => setDetailCustomer(null)}
        />
      )}
    </div>
  );
}
