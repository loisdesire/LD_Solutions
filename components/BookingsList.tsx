'use client';

import { useState } from 'react';
import ConversationPanel from './ConversationPanel';
import BookingDetailModal from './BookingDetailModal';
import { STATUS_LABELS, statusLabel, statusStyle } from '@/lib/bookingStatus';
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
  email,
  onOpen,
}: {
  phone: string;
  telegramUsername: string | null;
  email: string | null;
  onOpen: () => void;
}) {
  const { isBotContact, label } = parseContact(phone, telegramUsername, email);

  // Stops the click from also bubbling up to the row's own onClick (which
  // opens the full detail modal) - this has its own, more specific action.
  if (!isBotContact) {
    return (
      <a href={`tel:${phone}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
        {label}
      </a>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="text-accent hover:underline text-left"
    >
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
  // Two independent controls, not one flat pill row mixing them - "past"
  // is a time scope, "confirmed" is a status, and "all" is neither; they
  // used to sit in the same row as if they were equivalent choices.
  // `scope` decides WHICH bookings are in play (Upcoming / Today / Past);
  // `statusFilter` narrows whichever scope is active by status.
  const [scope, setScope] = useState<'upcoming' | 'today' | 'past'>('upcoming');
  const [statusFilter, setStatusFilter] = useState('all');
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
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Same "upcoming vs past" rule used on the customer account page - a
  // booking is only genuinely upcoming if it hasn't happened yet AND
  // hasn't been cancelled; everything else (elapsed, or cancelled at any
  // date) is history. This was the actual bug: the list never filtered by
  // time at all, so a booking from 12 days ago just sat at the top under
  // an "Upcoming" label that had nothing to do with what was shown.
  // A solo business assigns every booking to the same person, or to nobody,
  // so the Staff column is a column of one repeated name or a column of
  // dashes. Only worth its width once there is actually more than one
  // person to tell apart.
  const staffNames = new Set(
    bookings
      .map((b: any) => (Array.isArray(b.staff) ? b.staff[0]?.name : b.staff?.name))
      .filter(Boolean)
  );
  const showStaff = staffNames.size > 1;
  // Both variants written out in full, including the sm: prefix. Tailwind
  // only generates classes it can see literally in the source, so building
  // one with `sm:${...}` at runtime would produce a class that has no CSS
  // behind it and silently collapse the grid.
  const GRID_HEAD = showStaff
    ? 'grid-cols-[84px_1.3fr_1fr_0.85fr_0.9fr_100px]'
    : 'grid-cols-[84px_1.4fr_1.1fr_1fr_100px]';
  const GRID_ROW = showStaff
    ? 'sm:grid-cols-[84px_1.3fr_1fr_0.85fr_0.9fr_100px]'
    : 'sm:grid-cols-[84px_1.4fr_1.1fr_1fr_100px]';

  const isPast = scope === 'past';

  const upcoming = bookings.filter((b) => b.status !== 'cancelled' && new Date(b.start_time) >= now);
  const allPast = bookings.filter((b) => b.status === 'cancelled' || new Date(b.start_time) < now);
  // Today's whole day, not just what's still ahead of the current time -
  // a 10am appointment shouldn't vanish from "Today" at 11am just because
  // it's already started (or wasn't marked complete yet).
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const todayScoped = bookings.filter((b) => {
    if (b.status === 'cancelled') return false;
    const d = new Date(b.start_time);
    return d >= startOfToday && d < startOfTomorrow;
  });

  // Past defaults to the last 7 days. Showing everything ever booked made
  // the recent few rows, which are the ones anyone actually wants, sit
  // under a growing pile of history. A date range opens the rest.
  const usingRange = Boolean(fromDate || toDate);

  // Already windowed by the server query, so nothing to narrow here.
  const past = allPast;

  const scoped = isPast ? past : scope === 'today' ? todayScoped : upcoming;

  // This decides WHICH status pills exist, so a business with no
  // cancellations never sees a Cancelled pill. Counted from the upcoming
  // list regardless of which scope is active, so the pills don't appear
  // and disappear as you move between Upcoming/Today/Past.
  const counts = upcoming.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const visibleStatuses = Object.keys(STATUS_LABELS).filter((s) => counts[s] > 0);
  const statusFiltered = statusFilter === 'all' ? scoped : scoped.filter((b) => b.status === statusFilter);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? statusFiltered.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(query) ||
          (b.services?.name ?? '').toLowerCase().includes(query)
      )
    : statusFiltered;

  const SCOPE_HEADING: Record<typeof scope, string> = {
    upcoming: 'Upcoming bookings',
    today: "Today's bookings",
    past: 'Past bookings',
  };

  return (
    <div>
      {/* Scope (Upcoming/Today/Past) and status (No-show etc.) are still
          two independent pieces of state, not one exclusive choice - a
          business can genuinely be looking at "Upcoming" AND filtered to
          "No-show" at once. No "All" pill now: status is a toggle, not a
          tab - clicking the active one turns it back off instead of
          needing a separate option to return to. One shared track
          (rather than two separate PillTabs instances sitting next to
          each other) so it reads as one continuous row, status chips
          appended after Past. */}
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display text-[19px] font-semibold text-ink">{SCOPE_HEADING[scope]}</h2>
        <div className="inline-flex items-center gap-0.5 bg-warm-surface rounded-lg p-1 flex-wrap">
          {(
            [
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'today', label: 'Today' },
              { key: 'past', label: 'Past' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setScope(opt.key);
                // Leaving Past should not keep a range applied invisibly.
                if (opt.key !== 'past') setRange({ from: '', to: '' });
              }}
              aria-current={scope === opt.key ? 'true' : undefined}
              className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                scope === opt.key ? 'bg-surface text-ink shadow-lift' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {visibleStatuses.map((s) => {
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(isActive ? 'all' : s)}
                aria-pressed={isActive}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                  isActive ? 'bg-surface text-ink shadow-lift' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
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
      {/* border-line-strong, not border-line - same reasoning as
          CustomersManager's table: no card wrapper here, these dividers
          sit directly on the admin canvas, and border-line is too close
          in lightness to --admin-canvas on desktop to read as a divider
          at all. */}
      <div className="border-t-2 border-line-strong">
        <div className={`hidden sm:grid ${GRID_HEAD} gap-4 px-2 py-2.5 border-b border-line-strong font-mono text-label uppercase tracking-[0.12em] text-ink-faint`}>
          <div>Time</div>
          <div>Customer</div>
          <div>Service</div>
          {showStaff && <div>Staff</div>}
          <div>Contact</div>
          <div>Status</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-2 py-10 text-center text-body-sm text-ink-faint">
            No {statusFilter !== 'all' ? `${STATUS_LABELS[statusFilter]?.toLowerCase()} ` : ''}
            {scope === 'today' ? "bookings today" : `${scope} bookings`}.
          </div>
        ) : (
          filtered.map((b, i) => {
            const staffName = Array.isArray(b.staff) ? b.staff[0]?.name : b.staff?.name;
            return (
              <div
                key={b.id}
                // A real card on mobile (rounded, bordered, its own
                // background) instead of one more divided row in a flat
                // list - at sm+ this reverts to the existing plain-row
                // treatment, unchanged (border-0 clears all four sides,
                // then the conditional border-b below re-adds only the
                // bottom one, only between rows).
                //
                // Clickable everywhere now, opening the same detail/action
                // panel NextAppointmentCard gives the single next booking -
                // previously nothing on this row opened anything except the
                // contact link. role="button" + a key handler since this
                // wraps other interactive elements (contact link, status
                // pill), which rules out making the row itself a <button>.
                role="button"
                tabIndex={0}
                onClick={() => setDetailBooking(b)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailBooking(b);
                  }
                }}
                className={`cursor-pointer rounded-2xl border border-line bg-surface p-4 mb-3 shadow-soft sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:mb-0 sm:px-2 sm:py-4 hover:bg-warm-surface transition-colors ${
                  i !== filtered.length - 1 ? 'sm:border-b sm:border-line-strong' : ''
                } ${b.status === 'cancelled' ? 'opacity-55' : ''}`}
              >
                <div className={`flex flex-col gap-2.5 sm:grid ${GRID_ROW} sm:gap-4 sm:items-center`}>
                  <div className="flex items-center justify-between sm:block">
                    <div>
                      <span className="font-mono text-[12px] uppercase tracking-[0.05em] text-ink-faint">
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
                      className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] shrink-0 ${statusStyle(b.status)}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className={b.status === 'cancelled' ? 'line-through' : ''}>
                    <div className="font-semibold text-[14px] truncate">{b.customer_name}</div>
                    {b.customer_email && (
                      <div className="font-mono text-[12.5px] text-ink-faint truncate mt-0.5">
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

                  {showStaff && <div className="text-body-sm text-ink-soft truncate">{staffName ?? '-'}</div>}

                  <div className="flex items-center justify-between sm:block">
                    <span className="font-mono text-caption sm:text-[13px] truncate">
                      <ContactCell
                        phone={b.customer_phone}
                        telegramUsername={b.customer_telegram_username}
                        email={b.customer_email}
                        onOpen={() => setOpenConversation(b)}
                      />
                    </span>
                  </div>

                  <span
                    className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] shrink-0 w-fit ${statusStyle(b.status)}`}
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

      {detailBooking && (
        <BookingDetailModal slug={slug} booking={detailBooking} onClose={() => setDetailBooking(null)} />
      )}
    </div>
  );
}
