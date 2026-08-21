'use client';

import { useState } from 'react';
import ConversationPanel from './ConversationPanel';
import { STATUS_LABELS, statusLabel, statusStyle } from '@/lib/bookingStatus';
import PillTabs from './PillTabs';
import { parseContact } from '@/lib/contact';
import { useRouter, useSearchParams } from 'next/navigation';

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_telegram_username: string | null;
  start_time: string;
  status: string;
  // Supabase's join typing returns this array-shaped even for a to-one
  // relation; `any` here matches how the rest of this codebase already
  // works around that rather than fighting its inference.
  services: any;
  staff?: any;
};

function relativeDay(date: Date, today: Date): string {
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// For whatsapp:/telegram: contacts, deliberately NOT a wa.me/t.me link -
// those open the *owner's own personal* WhatsApp/Telegram, a different
// identity than the bot the customer was actually talking to (a WhatsApp
// Business API number can't double as a normal consumer WhatsApp account
// on someone's phone, so there's no way around that via a link). Clicking
// the contact itself opens the conversation panel instead, which sends
// through the bot's real identity - the customer sees it as the same
// thread continuing. Plain web-form phone numbers have no bot involved at
// all, so a normal tel: link is correct and sufficient there.
function ContactCell({
  phone,
  telegramUsername,
  onOpen,
}: {
  phone: string;
  telegramUsername: string | null;
  onOpen: () => void;
}) {
  const { isBotContact, label } = parseContact(phone, telegramUsername);

  if (!isBotContact) {
    return (
      <a href={`tel:${phone}`} className="text-accent hover:underline">
        {label}
      </a>
    );
  }

  return (
    <button onClick={onOpen} className="text-accent hover:underline text-left">
      {label}
    </button>
  );
}

export default function BookingsList({
  slug,
  bookings,
  search = '',
}: {
  slug: string;
  bookings: Booking[];
  search?: string;
}) {
  // One filter, not a scope toggle plus a filter. "past" sits alongside
  // the status pills because that is how it reads to a user: another way
  // to narrow the same list, not a separate screen to navigate to.
  const [filter, setFilter] = useState('all');
  // The range lives in the URL rather than component state, because the
  // server query reads it. Changing a date re-runs the query against the
  // database instead of filtering a list the browser already holds.
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDate = searchParams.get('from') ?? '';
  const toDate = searchParams.get('to') ?? '';

  function setRange(next: { from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(params.toString() ? `?${params.toString()}` : '?', { scroll: false });
  }
  const [openConversation, setOpenConversation] = useState<Booking | null>(null);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Same "upcoming vs past" rule used on the customer account page - a
  // booking is only genuinely upcoming if it hasn't happened yet AND
  // hasn't been cancelled; everything else (elapsed, or cancelled at any
  // date) is history. This was the actual bug: the list never filtered by
  // time at all, so a booking from 12 days ago just sat at the top under
  // an "Upcoming" label that had nothing to do with what was shown.
  const isPast = filter === 'past';

  const upcoming = bookings.filter((b) => b.status !== 'cancelled' && new Date(b.start_time) >= now);
  const allPast = bookings.filter((b) => b.status === 'cancelled' || new Date(b.start_time) < now);

  // Past defaults to the last 7 days. Showing everything ever booked made
  // the recent few rows, which are the ones anyone actually wants, sit
  // under a growing pile of history. A date range opens the rest.
  const usingRange = Boolean(fromDate || toDate);

  // Already windowed by the server query, so nothing to narrow here.
  const past = allPast;

  const scoped = isPast ? past : upcoming;

  // Not shown any more, but still needed: this decides WHICH status pills
  // exist, so a business with no cancellations never sees a Cancelled pill.
  // Counted from the upcoming list even while Past is selected, so the pills
  // do not appear and disappear as you move between them.
  const counts = upcoming.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const visibleStatuses = Object.keys(STATUS_LABELS).filter((s) => counts[s] > 0);
  const statusFiltered = filter === 'all' || isPast ? scoped : scoped.filter((b) => b.status === filter);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? statusFiltered.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(query) ||
          (b.services?.name ?? '').toLowerCase().includes(query)
      )
    : statusFiltered;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display text-[19px] font-semibold text-ink">
          {isPast ? 'Past bookings' : 'Upcoming bookings'}
        </h2>
        <PillTabs
          active={filter}
          onChange={(f) => {
            setFilter(f);
            // Leaving Past should not keep a range applied invisibly.
            if (f !== 'past') setRange({ from: '', to: '' });
          }}
          options={[
            // No counts. Past cannot carry one now that the browser only
            // holds a window of history, and a row where some pills are
            // numbered and one is not reads as though that one is broken.
            { key: 'all', label: 'All' },
            ...visibleStatuses.map((s) => ({ key: s, label: STATUS_LABELS[s] })),
            { key: 'past', label: 'Past' },
          ]}
        />
      </div>

      {isPast && (
        <div className="flex flex-wrap items-end gap-3 mb-4 rounded-xl bg-warm-surface px-4 py-3">
          <div>
            <label htmlFor="past-from" className="block font-mono text-label uppercase tracking-[0.1em] text-ink-faint mb-1">
              From
            </label>
            <input
              id="past-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setRange({ from: e.target.value })}
              className="rounded-lg border-2 border-line-strong bg-surface px-3 py-2 min-h-[40px] text-body-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="past-to" className="block font-mono text-label uppercase tracking-[0.1em] text-ink-faint mb-1">
              To
            </label>
            <input
              id="past-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setRange({ to: e.target.value })}
              className="rounded-lg border-2 border-line-strong bg-surface px-3 py-2 min-h-[40px] text-body-sm outline-none focus:border-accent"
            />
          </div>
          {usingRange ? (
            <button
              type="button"
              onClick={() => setRange({ from: '', to: '' })}
              className="px-3.5 py-2 min-h-[40px] rounded-lg text-caption font-semibold transition-colors hover:bg-surface"
              style={{ color: 'var(--accent)' }}
            >
              Back to last 7 days
            </button>
          ) : (
            <p className="text-caption text-ink-faint pb-2.5">
              Showing the last 7 days. Pick dates to look further back.
            </p>
          )}
        </div>
      )}

      {/* Deliberately not a bordered box anymore - a top rule plus row
          dividers reads as a schedule, not another card among cards, and
          it's the section that matters most on the page, so it shouldn't
          compete visually with everything boxed around it. */}
      <div className="border-t-2 border-line">
        <div className="hidden sm:grid grid-cols-[84px_1.3fr_1fr_0.85fr_0.9fr_100px] gap-4 px-2 py-2.5 border-b border-line font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          <div>Time</div>
          <div>Customer</div>
          <div>Service</div>
          <div>Staff</div>
          <div>Contact</div>
          <div>Status</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-2 py-10 text-center text-body-sm text-ink-faint">
            No {isPast ? 'past' : filter === 'all' ? 'upcoming' : STATUS_LABELS[filter]?.toLowerCase()} bookings.
          </div>
        ) : (
          filtered.map((b, i) => {
            const staffName = Array.isArray(b.staff) ? b.staff[0]?.name : b.staff?.name;
            return (
              <div
                key={b.id}
                className={`px-2 py-4 hover:bg-warm-surface transition-colors ${
                  i !== filtered.length - 1 ? 'border-b border-line' : ''
                } ${b.status === 'cancelled' ? 'opacity-55' : ''}`}
              >
                <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-[84px_1.3fr_1fr_0.85fr_0.9fr_100px] sm:gap-4 sm:items-center">
                  <div className="flex items-center justify-between sm:block">
                    <div>
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                        {relativeDay(new Date(b.start_time), startOfToday)}
                      </span>
                      <span
                        className="font-display text-body-sm font-semibold ml-2 sm:ml-0 sm:block sm:mt-0.5"
                        style={{ color: 'var(--accent)' }}
                      >
                        {new Date(b.start_time).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span
                      className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 ${statusStyle(b.status)}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className={b.status === 'cancelled' ? 'line-through' : ''}>
                    <div className="font-semibold text-[14px] truncate">{b.customer_name}</div>
                    {b.customer_email && (
                      <div className="font-mono text-[11.5px] text-ink-faint truncate mt-0.5">
                        {b.customer_email}
                      </div>
                    )}
                  </div>

                  <div className={b.status === 'cancelled' ? 'line-through' : ''}>
                    <span className="text-body-sm">{b.services?.name}</span>
                    {b.services?.duration_minutes != null && (
                      <span className="font-mono text-label text-ink-faint ml-2 sm:block sm:ml-0 sm:mt-0.5">
                        {b.services.duration_minutes} min
                      </span>
                    )}
                  </div>

                  <div className="text-[13px] text-ink-soft truncate">{staffName ?? '-'}</div>

                  <div className="flex items-center justify-between sm:block">
                    <span className="font-mono text-caption sm:text-[13px] truncate">
                      <ContactCell
                        phone={b.customer_phone}
                        telegramUsername={b.customer_telegram_username}
                        onOpen={() => setOpenConversation(b)}
                      />
                    </span>
                  </div>

                  <span
                    className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 w-fit ${statusStyle(b.status)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {openConversation && (
        <ConversationPanel
          slug={slug}
          customerPhone={openConversation.customer_phone}
          customerLabel={
            openConversation.customer_telegram_username
              ? `@${openConversation.customer_telegram_username}`
              : openConversation.customer_name
          }
          onClose={() => setOpenConversation(null)}
        />
      )}
    </div>
  );
}
