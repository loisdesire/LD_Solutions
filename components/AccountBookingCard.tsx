'use client';

import { useState } from 'react';
import Link from 'next/link';
import WebChatWidget from './WebChatWidget';

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

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-accent-soft text-accent',
  completed: 'bg-ink-wash text-ink-faint',
  cancelled: 'bg-ink-wash text-ink-faint line-through',
  no_show: 'bg-error-bg text-error',
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
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${STATUS_STYLE[booking.status] ?? 'bg-ink-wash text-ink-faint'}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {STATUS_LABEL[booking.status] ?? booking.status}
          </span>
          <div className="flex items-center gap-2.5">
            {business?.id && (
              <button
                onClick={() => setWidgetOpen(true)}
                aria-label={`Message ${business.name}`}
                title={`Message ${business.name}`}
                className="h-7 w-7 rounded-full flex items-center justify-center text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v12H8l-4 4V4z" />
                  <path d="M8 9h8M8 12h5" />
                </svg>
              </button>
            )}
            {business?.slug && (
              <Link
                href={`/${business.slug}/manage/${booking.id}`}
                className="text-[12.5px] font-semibold text-accent hover:underline"
              >
                Manage
              </Link>
            )}
          </div>
        </div>
      </div>

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
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-[12.5px] whitespace-pre-wrap ${
                      m.role === 'user' ? 'bg-accent-soft text-ink' : 'bg-accent text-white'
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
          the business's own page, right here. */}
      {widgetOpen && business?.id && <WebChatWidget businessId={business.id} defaultOpen />}
    </div>
  );
}
