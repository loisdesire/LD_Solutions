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

export default function BookingsList({ slug, bookings }: { slug: string; bookings: Booking[] }) {
  const [filter, setFilter] = useState('all');
  const [openConversation, setOpenConversation] = useState<Booking | null>(null);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const counts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const visibleStatuses = Object.keys(STATUS_LABELS).filter((s) => counts[s] > 0);
  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const pillClass = (active: boolean) =>
    `px-2.5 py-1 rounded-full transition-colors ${
      active ? 'bg-ink text-white' : 'text-ink-faint hover:text-ink'
    }`;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-display text-[18px]">Upcoming bookings</h2>
        <div className="flex items-center gap-1 font-mono text-[11px]">
          <button onClick={() => setFilter('all')} className={pillClass(filter === 'all')}>
            All {bookings.length}
          </button>
          {visibleStatuses.map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={pillClass(filter === s)}>
              {STATUS_LABELS[s]} {counts[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-line rounded-md overflow-hidden">
        <div className="hidden sm:grid grid-cols-[70px_1.4fr_1.3fr_1fr_120px] gap-4 px-5 py-2.5 bg-paper border-b border-line font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          <div>When</div>
          <div>Customer</div>
          <div>Service</div>
          <div>Contact</div>
          <div>Status</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13.5px] text-ink-faint">
            No {STATUS_LABELS[filter]?.toLowerCase() ?? ''} bookings.
          </div>
        ) : (
          filtered.map((b, i) => (
            <div
              key={b.id}
              className={`px-5 py-4 hover:bg-accent-soft/40 transition-colors ${
                i !== filtered.length - 1 ? 'border-b border-line' : ''
              } ${b.status === 'cancelled' ? 'opacity-55' : ''}`}
            >
              <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-[70px_1.4fr_1.3fr_1fr_120px] sm:gap-4 sm:items-center">
                <div className="flex items-center justify-between sm:block">
                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                      {relativeDay(new Date(b.start_time), startOfToday)}
                    </span>
                    <span className="font-mono text-[14px] text-accent ml-2 sm:ml-0 sm:block sm:mt-0.5">
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
