'use client';

import { useState } from 'react';
import ConversationPanel from './ConversationPanel';
import { parseContact } from '@/lib/contact';

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
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

const statusStyle: Record<string, string> = {
  confirmed: 'bg-accent-soft text-accent',
  completed: 'bg-ink/5 text-ink-faint',
  cancelled: 'bg-ink/5 text-ink-faint line-through',
  no_show: 'bg-red-50 text-red-600',
};

function relativeDay(date: Date, today: Date): string {
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// For whatsapp:/telegram: contacts, deliberately NOT a wa.me/t.me link —
// those open the *owner's own personal* WhatsApp/Telegram, a different
// identity than the bot the customer was actually talking to (a WhatsApp
// Business API number can't double as a normal consumer WhatsApp account
// on someone's phone, so there's no way around that via a link). Clicking
// the contact itself opens the conversation panel instead, which sends
// through the bot's real identity — the customer sees it as the same
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
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [filter, setFilter] = useState('all');
  const [openConversation, setOpenConversation] = useState<Booking | null>(null);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Same "upcoming vs past" rule used on the customer account page — a
  // booking is only genuinely upcoming if it hasn't happened yet AND
  // hasn't been cancelled; everything else (elapsed, or cancelled at any
  // date) is history. This was the actual bug: the list never filtered by
  // time at all, so a booking from 12 days ago just sat at the top under
  // an "Upcoming" label that had nothing to do with what was shown.
  const scoped = bookings.filter((b) =>
    scope === 'upcoming'
      ? b.status !== 'cancelled' && new Date(b.start_time) >= now
      : b.status === 'cancelled' || new Date(b.start_time) < now
  );

  const counts = scoped.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const visibleStatuses = Object.keys(STATUS_LABELS).filter((s) => counts[s] > 0);
  const statusFiltered = filter === 'all' ? scoped : scoped.filter((b) => b.status === filter);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? statusFiltered.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(query) ||
          (b.services?.name ?? '').toLowerCase().includes(query)
      )
    : statusFiltered;

  const pillClass = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${
      active ? 'text-white' : 'text-ink-faint hover:text-ink'
    }`;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-[19px] font-semibold text-ink">
            {scope === 'upcoming' ? 'Upcoming bookings' : 'Past bookings'}
          </h2>
          <button
            onClick={() => {
              setScope((s) => (s === 'upcoming' ? 'past' : 'upcoming'));
              setFilter('all');
            }}
            className="text-[12.5px] font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {scope === 'upcoming' ? 'View past →' : '← Back to upcoming'}
          </button>
        </div>
        <div className="flex items-center gap-1 bg-paper rounded-full p-1">
          <button
            onClick={() => setFilter('all')}
            className={pillClass(filter === 'all')}
            style={filter === 'all' ? { background: 'var(--accent)' } : undefined}
          >
            All {scoped.length}
          </button>
          {visibleStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={pillClass(filter === s)}
              style={filter === s ? { background: 'var(--accent)' } : undefined}
            >
              {STATUS_LABELS[s]} {counts[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-line rounded-xl overflow-hidden bg-surface">
        <div className="hidden sm:grid grid-cols-[70px_1.4fr_1.3fr_1fr_120px] gap-4 px-5 py-3 bg-paper border-b border-line font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          <div>When</div>
          <div>Customer</div>
          <div>Service</div>
          <div>Contact</div>
          <div>Status</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13.5px] text-ink-faint">
            No {filter === 'all' ? scope : STATUS_LABELS[filter]?.toLowerCase()} bookings.
          </div>
        ) : (
          filtered.map((b, i) => (
            <div
              key={b.id}
              className={`px-5 py-5 hover:bg-accent-soft/40 transition-colors ${
                i !== filtered.length - 1 ? 'border-b border-line' : ''
              } ${b.status === 'cancelled' ? 'opacity-55' : ''}`}
            >
              <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-[70px_1.4fr_1.3fr_1fr_120px] sm:gap-4 sm:items-center">
                <div className="flex items-center justify-between sm:block">
                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                      {relativeDay(new Date(b.start_time), startOfToday)}
                    </span>
                    <span
                      className="font-display text-[16px] font-semibold ml-2 sm:ml-0 sm:block sm:mt-0.5"
                      style={{ color: 'var(--accent)' }}
                    >
                      {new Date(b.start_time).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span
                    className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 ${statusStyle[b.status] ?? 'bg-ink/5 text-ink-faint'}`}
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

                <div className={`flex items-center justify-between sm:block ${b.status === 'cancelled' ? 'line-through' : ''}`}>
                  <div>
                    <span className="text-[13.5px]">{b.services?.name}</span>
                    {b.services?.duration_minutes != null && (
                      <span className="font-mono text-[11px] text-ink-faint ml-2 sm:block sm:ml-0 sm:mt-0.5">
                        {b.services.duration_minutes} min
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[12px] sm:hidden">
                    <ContactCell
                      phone={b.customer_phone}
                      telegramUsername={b.customer_telegram_username}
                      onOpen={() => setOpenConversation(b)}
                    />
                  </span>
                </div>

                <div className="hidden sm:block font-mono text-[13px] truncate">
                  <ContactCell
                    phone={b.customer_phone}
                    telegramUsername={b.customer_telegram_username}
                    onOpen={() => setOpenConversation(b)}
                  />
                </div>

                <span
                  className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 w-fit ${statusStyle[b.status] ?? 'bg-ink/5 text-ink-faint'}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {b.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))
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
