'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardHeaderActions from './DashboardHeaderActions';
import BookingsList from './BookingsList';
import { statusLabel, statusStyle } from '@/lib/bookingStatus';
import AskAssistantBar from './AskAssistantBar';

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_telegram_username: string | null;
  start_time: string;
  status: string;
  services: any;
  staff?: any;
};

// One stat inside the Today strip - not its own bordered card. The strip
// itself is the single card; each stat is just a labeled number with a
// hairline divider between them, so three (or four, with Next
// appointment) numbers read as one connected summary of the day instead
// of a row of identical boxes competing for attention. `emphasis` gives
// "Next up" more visual weight than the other three - it's the one
// number that's actually actionable ("what do I need to do right now"),
// so it shouldn't tie visually with static counts.
function TodayStat({
  label,
  value,
  sub,
  delta,
  color = 'var(--ink)',
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Kept separate from `sub` so a fall can read differently from a rise. */
  delta?: { value: string; up: boolean };
  color?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="font-mono text-label uppercase tracking-[0.12em] text-ink-faint mb-1">{label}</div>
      <div
        className={`font-display font-bold leading-none ${emphasis ? 'text-[30px]' : 'text-[24px]'}`}
        style={{ color }}
      >
        {value}
      </div>
      <div className={`flex items-baseline gap-1.5 mt-1 ${emphasis ? 'max-w-[220px]' : ''}`}>
        {sub && <span className="text-caption text-ink-faint truncate">{sub}</span>}
        {delta && <span className="text-caption text-ink-faint shrink-0">{delta.value}</span>}
      </div>
    </div>
  );
}

export default function AdminDashboardBody({
  slug,
  businessName,
  businessId,
  analyticsEnabled,
  services,
  maxAdvanceDays,
  all,
  todayCount,
  todayRevenue,
  thisWeekCount,
  weekCountDelta,
  weekRevenue,
  revenuePctDelta,
  nextSlot,
}: {
  slug: string;
  businessName: string;
  businessId: string;
  analyticsEnabled: boolean;
  services: { id: string; name: string; duration_minutes: number; price: number | null }[];
  maxAdvanceDays: number;
  all: Booking[];
  todayCount: number;
  todayRevenue: number;
  thisWeekCount: number;
  weekCountDelta: number;
  weekRevenue: number;
  revenuePctDelta: number | null;
  nextSlot: Booking | undefined;
}) {
  const [search, setSearch] = useState('');

  // Starts null so the server-rendered markup and the first client render
  // match exactly (a stale server-time "in 45m" badge, or a hydration
  // mismatch) - fills in a tick after mount, then stays current.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const minutesUntilNext =
    nextSlot && now !== null ? Math.round((new Date(nextSlot.start_time).getTime() - now) / 60000) : null;
  const nextSlotLabel =
    nextSlot == null
      ? '-'
      : minutesUntilNext !== null && minutesUntilNext >= 0 && minutesUntilNext <= 180
        ? minutesUntilNext < 60
          ? `In ${Math.max(minutesUntilNext, 1)}m`
          : `In ${Math.floor(minutesUntilNext / 60)}h ${minutesUntilNext % 60}m`
        : new Date(nextSlot.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const hour = now ? new Date(now).getHours() : null;
  const greeting =
    hour === null ? '' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // One sentence instead of making them read four stat tiles to work out
  // whether anything needs them today.
  const nextIsToday =
    nextSlot && new Date(nextSlot.start_time).toDateString() === new Date(now ?? Date.now()).toDateString();
  const daySummary =
    todayCount === 0
      ? 'Nothing booked today. A good day to get ahead of things.'
      : nextIsToday
        ? `${todayCount} ${todayCount === 1 ? 'appointment' : 'appointments'} today. Next is ${nextSlot!.customer_name} at ${new Date(nextSlot!.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`
        : `${todayCount} ${todayCount === 1 ? 'appointment' : 'appointments'} today, all done.`;

  return (
    <div>
      {/* Two rows became one. The greeting sat alone above a row holding
          only the search box and the action buttons, so the page spent
          roughly 140px before any of the day's information. `now` is null
          until the effect runs, so the server never renders a
          time-dependent greeting and there is no hydration mismatch. */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">
            {now
              ? new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Today'}
          </div>
          <h1 className="font-display text-h1 text-ink">
            {now ? `${greeting}, ${businessName}` : businessName}
          </h1>
          <p className="text-ink-soft text-body-sm mt-1">{daySummary}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 lg:pt-1">
          {/* Search only earns its place once there is enough to search
              through. Below that it is a permanent empty box on a page
              whose whole job is showing you a short list. */}
          {all.length > 8 && (
            <div className="flex items-center gap-2 bg-surface border-2 border-line rounded-full px-4 py-2.5 min-h-[44px] flex-1 lg:flex-none lg:w-64 transition-colors focus-within:border-[var(--accent)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search customers or bookings"
                placeholder="Search"
                className="bg-transparent border-none outline-none text-body-sm text-ink placeholder-ink-faint w-full"
              />
            </div>
          )}
          <DashboardHeaderActions
            slug={slug}
            businessId={businessId}
            services={services}
            maxAdvanceDays={maxAdvanceDays}
          />
        </div>
      </div>

      {/* Sits on --warm-surface on desktop and --paper on mobile, so it
          needs to lift off both. A hardcoded cream (#f5efe4) was tried and
          clashed: it was warm against a palette that had been cooled.
          White with a hairline is the same treatment every other card in
          the app uses, so it reads as elevated and cannot drift out of
          step with the tokens again. */}
      {all.length > 0 && (
        <div className="rounded-2xl bg-surface border border-line px-5 py-5 mb-8 shadow-soft">
          <div className="flex flex-wrap gap-x-8 gap-y-5">
            <TodayStat
              label="Next up"
              value={nextSlotLabel}
              sub={nextSlot ? `${nextSlot.customer_name} · ${(nextSlot as any).services?.name ?? ''}` : 'Nothing scheduled'}
              color="var(--accent)"
              emphasis
            />
            <TodayStat label="Today" value={String(todayCount)} sub={todayCount === 1 ? 'appointment' : 'appointments'} />
            <TodayStat label="Today's revenue" value={todayRevenue != null ? `₦${todayRevenue.toLocaleString()}` : '-'} />
            <TodayStat
              label="This week"
              value={String(thisWeekCount)}
              sub={weekRevenue != null ? `₦${weekRevenue.toLocaleString()}` : undefined}
              delta={
                revenuePctDelta != null && revenuePctDelta !== 0
                  ? { value: `${revenuePctDelta > 0 ? '+' : ''}${revenuePctDelta}%`, up: revenuePctDelta > 0 }
                  : weekCountDelta !== 0
                    ? { value: `${weekCountDelta > 0 ? '+' : ''}${weekCountDelta} vs last week`, up: weekCountDelta > 0 }
                    : undefined
              }
            />
          </div>
        </div>
      )}

      <AskAssistantBar
        slug={slug}
        suggestions={
          analyticsEnabled
            ? ['How much did I make this month?', 'Who are my top customers?', "I'm out sick tomorrow"]
            : ["I'm out sick tomorrow", 'Move my next appointment to Friday']
        }
      />

      {all.length === 0 ? (
        <div className="border-2 border-dashed border-line-strong rounded-3xl p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-display text-[20px]">No bookings yet - that's normal</h2>
          <p className="text-ink-soft text-body-sm mt-1.5 max-w-sm mx-auto">
            The moment someone books through your page, they'll show up right here with all their
            details.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href={`/${slug}/admin/services`}
              className="rounded-md border border-line-strong px-4 py-2 text-body-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Add a service
            </Link>
            <Link
              href={`/${slug}/admin/hours`}
              className="rounded-md border border-line-strong px-4 py-2 text-body-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Set your hours
            </Link>
          </div>
          <div className="font-mono text-label text-ink-faint mt-6 tracking-[0.05em]">/{slug}</div>
        </div>
      ) : (
        <BookingsList slug={slug} bookings={all} search={search} />
      )}

    </div>
  );
}
