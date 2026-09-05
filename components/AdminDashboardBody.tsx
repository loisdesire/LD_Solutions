'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardHeaderActions from './DashboardHeaderActions';
import BookingsList from './BookingsList';
import SetupChecklist from './SetupChecklist';
import ProfileReminderBanner from './ProfileReminderBanner';
import EnableNotificationsBanner from './EnableNotificationsBanner';
import { formatMoney } from '@/lib/formatMoney';

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

// One stat inside the Today strip, all four (Next up, Today, Today's
// revenue, This week) the same size and on one line - not one panel with
// actions sitting above three plain numbers. Actions (call, reschedule,
// cancel...) live where they always did: click into a booking from the
// list below. This card's job is just "what's the state of today," at a
// glance, nothing more.
//
// Two genuinely different compositions, not one shrunk to fit the other.
// Desktop (sm: and up) is unchanged: a vertical tile, four side by side.
// Mobile was the same tile forced into a 2-column wrap (flex-wrap on the
// parent) - two stats per row, but nothing made those rows align with
// each other, so a stat with a sub-line sat at a different height than
// its neighbour, and "Next up" empty ("-" in accent orange, alone, with
// a full tile's worth of space around it) read like a rendering glitch
// rather than an empty state. Below sm, this is now a single-column list
// instead: label (+ sub, if any) on the left, value (+ delta, if any) on
// the right, one row per stat, divided by real rules - the same shape
// every stats list like this actually takes on a phone.
function TodayStat({
  label,
  value,
  sub,
  delta,
  color = 'var(--ink)',
}: {
  label: string;
  value: string;
  sub?: string;
  /** Kept separate from `sub` so a fall can read differently from a rise. */
  delta?: { value: string; up: boolean };
  color?: string;
}) {
  return (
    // px-4 rather than a gap on the parent row - a gap sits entirely on
    // one side of the lg: divider (all 32px before it, 0px after), so the
    // line reads as glued to whichever stat comes next instead of
    // sitting centered in the space between two stats. Padding on both
    // sides of every stat puts 16px on each side of the divider instead,
    // and does the row's normal spacing job too, so gap-x-8 on the
    // parent goes away entirely rather than doubling up with this.
    <div className="flex items-center justify-between gap-4 py-3 sm:block sm:py-0 sm:flex-1 sm:min-w-[120px] sm:px-4">
      <div className="min-w-0">
        <div className="text-caption font-semibold text-ink-faint sm:mb-1">{label}</div>
        {sub && <div className="text-caption text-ink-faint truncate sm:hidden">{sub}</div>}
      </div>
      <div className="text-right shrink-0 sm:text-left">
        <div className="font-display text-[20px] sm:text-[24px] font-bold leading-none" style={{ color }}>
          {value}
        </div>
        <div className="hidden items-baseline gap-1.5 mt-1 sm:flex">
          {sub && <span className="text-caption text-ink-faint truncate">{sub}</span>}
          {delta && (
            <span className={`text-caption font-semibold shrink-0 ${delta.up ? 'text-success' : 'text-error'}`}>
              {delta.up ? '↑' : '↓'} {delta.value}
            </span>
          )}
        </div>
        {delta && (
          <div className="mt-0.5 sm:hidden">
            <span className={`text-caption font-semibold ${delta.up ? 'text-success' : 'text-error'}`}>
              {delta.up ? '↑' : '↓'} {delta.value}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardBody({
  slug,
  businessName,
  businessId,
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
  profileDone,
  servicesDone,
  hoursDone,
  paymentDone,
  hasLogo,
  hasDescription,
}: {
  slug: string;
  businessName: string;
  businessId: string;
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
  profileDone: boolean;
  servicesDone: boolean;
  hoursDone: boolean;
  paymentDone: boolean;
  hasLogo: boolean;
  hasDescription: boolean;
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
  // Bare time-of-day with no date at all once the countdown window passes -
  // confirmed live: a next appointment 2 days out showed as "9:00 AM" with
  // nothing distinguishing it from "today at 9am", which reads as a
  // contradiction next to the "Nothing booked today" line right above it.
  // Today/Tomorrow/short-weekday prefix, same convention used elsewhere in
  // the admin (reminders, the calendar's own day labels).
  function dayPrefix(startTime: string): string {
    const start = new Date(startTime);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const today = new Date();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const daysOut = Math.round((startDay - todayDay) / 86400000);
    if (daysOut === 0) return 'Today';
    if (daysOut === 1) return 'Tomorrow';
    return start.toLocaleDateString(undefined, { weekday: 'short' });
  }

  const nextSlotLabel =
    nextSlot == null
      ? '-'
      : minutesUntilNext !== null && minutesUntilNext >= 0 && minutesUntilNext <= 180
        ? minutesUntilNext < 60
          ? `In ${Math.max(minutesUntilNext, 1)}m`
          : `In ${Math.floor(minutesUntilNext / 60)}h ${minutesUntilNext % 60}m`
        : `${dayPrefix(nextSlot.start_time)} ${new Date(nextSlot.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

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
      {/* Was: greeting block and a search+actions block, laid out as two
          side-by-side columns above lg: and two full-width stacked rows
          below it - which meant Copy link/Export/New appointment claimed
          an entire row of their own under the greeting on every phone
          width, mostly empty space around three small buttons. One
          consistent shape now, at every width: a compact top strip pairing
          the short date label with the actions (they're comparable widths,
          so they actually belong on the same line), then the real content
          - name, summary, search - flows below as its own full-width
          block instead of fighting the actions for horizontal room. */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] font-semibold text-accent">
            {now
              ? new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Today'}
          </div>
          <DashboardHeaderActions
            slug={slug}
            businessId={businessId}
            services={services}
            maxAdvanceDays={maxAdvanceDays}
          />
        </div>
        <h1 className="font-display text-h1 text-ink mt-1">
          {now ? `${greeting}, ${businessName}` : businessName}
        </h1>
        <p className="text-ink-soft text-body-sm mt-1">{daySummary}</p>

        {/* Search only earns its place once there is enough to search
            through. Below that it is a permanent empty box on a page
            whose whole job is showing you a short list. */}
        {all.length > 8 && (
          <div className="flex items-center gap-2 bg-surface border border-line-strong rounded-lg px-4 py-2.5 min-h-[44px] mt-4 lg:w-64 transition-colors focus-within:border-[var(--accent)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search customers or bookings"
              placeholder="Search"
              className="bg-transparent border-none outline-none focus:outline-none rounded-lg px-1 -mx-1 text-body-sm text-ink placeholder-ink-faint w-full"
            />
          </div>
        )}
      </div>

      {/* Was findable only by going looking in the nav (sidebar/rail/
          mobile menu) - this puts the same ask on the one screen
          everyone actually lands on. Renders nothing once notifications
          are already on/blocked/unsupported, or once dismissed. */}
      <EnableNotificationsBanner slug={slug} />

      <SetupChecklist
        slug={slug}
        profileDone={profileDone}
        servicesDone={servicesDone}
        hoursDone={hoursDone}
        paymentDone={paymentDone}
      />
      <ProfileReminderBanner slug={slug} profileDone={profileDone} hasLogo={hasLogo} hasDescription={hasDescription} />

      {/* One card, one line - Next up, Today, Today's revenue, This week
          all the same size, side by side, not a detail panel with its
          own actions sitting above three plain numbers. Call/Reschedule/
          Cancel etc. aren't needed here: they're one click away already
          (open the booking from the list below), and pulling them onto
          this strip meant a taller two-row card for a control most
          mornings go unused.

          This card carried a real tint before a since-reverted "cooler"
          palette pass made it clash and it got stripped to plain white
          (see git history on this file, commit b9ce780). Three swings at
          bringing it back: bg-warm-surface sat only a couple of points
          off --paper and read as "no background"; plain --cream-surface
          was a full-strength mustard fill; mixed 45% into white it was
          still an unrelated hue sitting on top of the page rather than
          growing out of it. Mixed a little cream into --paper itself
          (the page's own background, not white) instead - the card is
          a warmer step along the same tone the page already is, not a
          different color dropped onto it.

          Originally shipped with no border at all - the tone shift
          against --paper was enough on its own to separate the card
          from the page. That stopped being true once the desktop admin
          canvas became its own, darker --admin-canvas token instead of
          --paper: this card's tint is still mixed from --paper, so
          against the new canvas it can end up *lighter* than the page
          around it instead of a step warmer, which reads as no card at
          all rather than a different problem than before. border-line-
          strong (not the plain, now-too-close-to-admin-canvas
          border-line) gives it a real edge regardless of how the tint
          and the canvas happen to compare - shadow-soft stays for the
          same lift every other card in the app uses. */}
      {all.length > 0 && (
        <div
          className="rounded-2xl border border-line-strong px-5 py-5 mb-8 shadow-soft"
          style={{ background: 'color-mix(in srgb, var(--cream-surface) 22%, var(--paper))' }}
        >
          {/* Dividers only from lg: up - below that, at 4 stats x
              min-w-[120px], the row doesn't reliably have the ~576px it
              needs and wraps onto two lines (no sidebar below 900px, and
              even with it the content column is still tight until lg:).
              A divide-x sibling border doesn't know about wrapping - it'd
              draw a dangling line on whichever stat starts a second row.
              Gated to the width where four in a row is actually safe.
              divide-line-strong, not the plain divide-line first tried -
              --line (#e7e2da) sits almost the same lightness as this
              card's cream tint, so the divider was technically there and
              functionally invisible. --line-strong is the token the app
              already reaches for whenever a border needs to actually
              read against a tinted surface, not a white one.

              -mx-4 cancels out the px-4 each TodayStat now carries (see
              its own comment) so the first/last stat's content still
              lands exactly on the card's own px-5 edge instead of
              sitting 16px further in than every other card in the app. */}
          <div className="flex flex-col divide-y divide-line-strong sm:flex-row sm:flex-wrap sm:divide-y-0 sm:-mx-4 sm:gap-y-5 lg:divide-x lg:divide-line-strong">
            <TodayStat
              label="Next up"
              value={nextSlotLabel}
              sub={nextSlot ? `${nextSlot.customer_name} · ${(nextSlot as any).services?.name ?? ''}` : 'Nothing scheduled'}
              // Accent only when there's actually something to draw the eye
              // to - on empty days this rendered a lone "-" in brand orange
              // with nothing around it, which read as a glitch, not an
              // empty state. Neutral ink when there's nothing next.
              color={nextSlot ? 'var(--accent)' : 'var(--ink-faint)'}
            />
            <TodayStat label="Today" value={String(todayCount)} sub={todayCount === 1 ? 'appointment' : 'appointments'} />
            {/* Was the one stat in this row with nothing under its number -
                every neighbour has a second line, so this one read as
                incomplete/broken rather than just "nothing to add here."
                todayCount is already in scope; ties the revenue figure back
                to where it came from instead of a bare number floating on
                its own. */}
            <TodayStat
              label="Today's revenue"
              value={formatMoney(todayRevenue)}
              sub={todayCount === 0 ? 'no bookings yet' : `from ${todayCount} ${todayCount === 1 ? 'appointment' : 'appointments'}`}
            />
            <TodayStat
              label="This week"
              value={String(thisWeekCount)}
              sub={weekRevenue != null ? formatMoney(weekRevenue) : undefined}
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

      {all.length === 0 ? (
        <div className="border border-line rounded-2xl bg-warm-surface p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-14 w-14 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-display text-[20px] font-semibold">No bookings yet - that's normal</h2>
          <p className="text-ink-soft text-body-sm mt-1.5 max-w-sm mx-auto">
            The moment someone books through your page, they'll show up right here with all their
            details.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href={`/${slug}/admin/services`}
              className="rounded-lg border border-line-strong px-4 py-2 text-body-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Add a service
            </Link>
            <Link
              href={`/${slug}/admin/hours`}
              className="rounded-lg border border-line-strong px-4 py-2 text-body-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Set your hours
            </Link>
          </div>
          <div className="text-caption font-medium text-ink-faint mt-6">/{slug}</div>
        </div>
      ) : (
        <BookingsList slug={slug} bookings={all} search={search} />
      )}
    </div>
  );
}
