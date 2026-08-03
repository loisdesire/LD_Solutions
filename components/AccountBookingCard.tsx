'use client';

import { useState } from 'react';
import Link from 'next/link';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Booking = {
  id: string;
  business_id: string;
  customer_phone: string | null;
  start_time: string;
  status: string;
  // Supabase's inferred type for a to-one join is an array without
  // generated types (it can't know the relationship's cardinality) — this
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
  completed: 'bg-ink/5 text-ink-faint',
  cancelled: 'bg-ink/5 text-ink-faint line-through',
  no_show: 'bg-red-50 text-red-600',
};

export default function AccountBookingCard({
  booking,
  messages,
}: {
  booking: Booking;
  messages?: ChatMessage[];
}) {
  const [showChat, setShowChat] = useState(false);
  const business = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses;
  const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-[0_2px_10px_-6px_rgba(0,0,0,0.08)]">
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
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${STATUS_STYLE[booking.status] ?? 'bg-ink/5 text-ink-faint'}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {STATUS_LABEL[booking.status] ?? booking.status}
          </span>
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

      {messages && messages.length > 0 && (
        <>
          <button
            onClick={() => setShowChat((v) => !v)}
            className="w-full text-left px-4 py-2.5 border-t border-dashed border-line text-[12.5px] font-medium text-ink-faint hover:text-ink transition-colors"
          >
            {showChat ? 'Hide' : 'View'} conversation with the bot ({messages.length} messages)
          </button>
          {showChat && (
            <div className="px-4 pb-4 space-y-2.5 max-h-64 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-[12.5px] whitespace-pre-wrap ${
                      m.role === 'user' ? 'bg-accent-soft text-ink' : 'bg-paper text-ink-soft'
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
    </div>
  );
}
