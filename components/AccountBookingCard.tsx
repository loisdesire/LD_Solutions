'use client';

import { useState } from 'react';
import Link from 'next/link';
import WebChatWidget from './WebChatWidget';
import { statusLabel, statusStyle } from '@/lib/bookingStatus';
import { googleCalendarUrl } from '@/lib/googleCalendar';
import { formatMoney } from '@/lib/formatMoney';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Booking = {
  id: string;
  business_id: string;
  customer_phone: string | null;
  start_time: string;
  status: string;
  // Supabase's inferred type for a to-one join is an array without
  // generated types (it can't know the relationship's cardinality) - this
  // is normalized to a single object below, same as manage/[bookingId].
  businesses: any;
  services: any;
};

export default function AccountBookingCard({
  booking,
  messages,
}: {
  booking: Booking;
  messages?: ChatMessage[];
}) {
  const [showChat, setShowChat] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const business = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses;
  const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
  const isUpcoming = booking.status !== 'cancelled' && new Date(booking.start_time).getTime() >= Date.now();

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden transition-colors duration-200 hover:border-line-strong">
      <div className="p-4 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            {business?.name ?? 'Business'}
          </div>
          <div className={`font-display text-[16.5px] text-ink truncate mt-0.5 ${booking.status === 'cancelled' ? 'line-through' : ''}`}>
            {service?.name ?? 'Service'}
          </div>
          <div className="text-[12.5px] text-ink-soft mt-0.5">
            {new Date(booking.start_time).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            {' · '}
            {new Date(booking.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            {service?.price != null && <> · {formatMoney(service.price)}</>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${statusStyle(booking.status)}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusLabel(booking.status)}
          </span>
          <div className="flex items-center gap-2">
            {business?.id && (
              // Was h-7 w-7 (28px) - below a comfortable mobile touch
              // size. 44px minimum now, same convention as every other
              // icon-only tap target in the app.
              <button
                onClick={() => setWidgetOpen(true)}
                aria-label={`Message ${business.name}`}
                title={`Message ${business.name}`}
                className="h-11 w-11 rounded-full flex items-center justify-center text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v12H8l-4 4V4z" />
                  <path d="M8 9h8M8 12h5" />
                </svg>
              </button>
            )}
            {/* Was a plain text link, easy to miss next to the status pill
                above it - "Manage" is the actual primary action on this
                card (reschedule, cancel), so it gets button weight now. */}
            {business?.slug && (
              // min-h-11 to match the message button next to it now that
              // it's sized up - a 44px button beside a much shorter one
              // in the same row read as mismatched once the other one
              // was fixed.
              <Link
                href={`/${business.slug}/manage/${booking.id}`}
                className="min-h-11 inline-flex items-center rounded-full px-4 text-[12px] font-semibold text-accent-contrast transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                Manage
              </Link>
            )}
          </div>
        </div>
      </div>

      {isUpcoming && service?.name && (
        <div className="px-4 pb-3.5 -mt-1">
          <a
            href={googleCalendarUrl({
              title: `${service.name} at ${business?.name ?? 'your appointment'}`,
              startISO: booking.start_time,
              minutes: service.duration_minutes ?? 30,
              details: `Booked through Vanova`,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-faint hover:text-ink transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
            Add to calendar
          </a>
        </div>
      )}

      {messages && messages.length > 0 && (
        <>
          <button
            onClick={() => setShowChat((v) => !v)}
            className="w-full text-left px-4 py-2.5 border-t border-dashed border-line text-[12.5px] font-medium text-ink-faint hover:text-ink transition-colors"
          >
            {showChat ? 'Hide' : 'View'} conversation ({messages.length} messages)
          </button>
          {showChat && (
            <div className="px-4 pb-4 space-y-2.5 max-h-64 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`flex animate-rise ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-[12.5px] whitespace-pre-wrap ${
                      m.role === 'user' ? 'bg-accent-soft text-ink' : 'bg-accent text-accent-contrast'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Opens in place - clicking the chat icon above shouldn't navigate
          you off /account, it should just open the same widget used on
          the business's own page, right here. bookingId lets the server
          verify this customer already has a real conversation with this
          business (e.g. one that started on Telegram) and continue that
          thread, instead of starting a brand new anonymous one every time
          they message from their account instead of the channel they
          originally used - see app/api/web-chat/route.ts's resolveIdentity. */}
      {widgetOpen && business?.id && <WebChatWidget businessId={business.id} defaultOpen bookingId={booking.id} />}
    </div>
  );
}
