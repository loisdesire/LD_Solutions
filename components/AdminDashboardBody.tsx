'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import DashboardHeaderActions from './DashboardHeaderActions';
import BookingsList from './BookingsList';
import SetupChecklist from './SetupChecklist';
import ProfileReminderBanner from './ProfileReminderBanner';
import EnableNotificationsBanner from './EnableNotificationsBanner';
import ConversationPanel from './ConversationPanel';
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
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Kept separate from `sub` so a fall can read differently from a rise. */
  delta?: { value: string; up: boolean };
  color?: string;
  /** Material Symbols name for this card's icon badge. */
  icon: string;
}) {
  return (
    // One card style at every width now, not a mobile-card/desktop-strip
    // split - the strip broke for real once a value was actually long
    // ("Tomorrow 9:30 AM" collided into the next stat's own label,
    // confirmed live in a screenshot). min-w-0 + truncate on the value
    // below is what actually prevents that from happening again: the grid
    // column itself now hard-bounds the width, and overflow text is cut
    // with an ellipsis instead of spilling into whatever sits next to it.
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] sm:text-[11px] font-semibold text-ink-faint uppercase tracking-wider truncate">
          {label}
        </div>
        <span
          className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full shrink-0"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <Icon name={icon} size={13} />
        </span>
      </div>
      <div className="mt-2">
        <div
          className="font-display text-[18px] sm:text-[20px] font-bold tracking-tight leading-tight truncate"
          style={{ color }}
        >
          {value}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
          {sub && <span className="text-caption text-ink-faint truncate">{sub}</span>}
          {delta && (
            <span
              className={`inline-flex items-center rounded text-[11px] font-semibold px-1.5 py-0.5 border shrink-0 ${delta.up ? 'text-success bg-success-bg border-success-border' : 'text-error bg-error-bg border-error-border'}`}
            >
              {delta.value}
            </span>
          )}
        </div>
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
  todayCollected,
  thisWeekCount,
  weekCountDelta,
  weekRevenue,
  weekCollected,
  revenuePctDelta,
  nextSlot,
  acceptingBookings,
  profileDone,
  servicesDone,
  hoursDone,
  paymentDone,
  hasLogo,
  hasDescription,
  pendingReviews,
}: {
  slug: string;
  businessName: string;
  businessId: string;
  services: { id: string; name: string; duration_minutes: number; price: number | null }[];
  maxAdvanceDays: number;
  all: Booking[];
  todayCount: number;
  todayRevenue: number;
  todayCollected: number;
  thisWeekCount: number;
  weekCountDelta: number;
  weekRevenue: number;
  weekCollected: number;
  revenuePctDelta: number | null;
  nextSlot: Booking | undefined;
  acceptingBookings: boolean;
  profileDone: boolean;
  servicesDone: boolean;
  hoursDone: boolean;
  paymentDone: boolean;
  hasLogo: boolean;
  hasDescription: boolean;
  // lib/whatsappTools.ts's requestOwnerReview - the customer-facing AI
  // escalating something it wouldn't guess at. Empty on a database the
  // owner_reviews migration hasn't reached yet, same as any other
  // not-yet-migrated feature - never breaks the rest of the dashboard.
  pendingReviews: { id: string; customer_phone: string; customer_label: string; question: string; created_at: string }[];
}) {
  const [search, setSearch] = useState('');
  // Which pending review's conversation is open, if any - opens the same
  // ConversationPanel a "message this customer" flow already uses
  // elsewhere; a reply sent through it marks the review answered
  // automatically (app/api/admin/message-customer's own doing), nothing
  // extra to track here beyond which one is currently open.
  const [openReview, setOpenReview] = useState<{ customerPhone: string; customerLabel: string } | null>(null);

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

  // Two formats, toggled by breakpoint rather than picked in JS - the
  // long form ("Thursday, 10 September") plus the full-length status pill
  // ("Accepting online bookings") run past 400px combined, on a mobile
  // content width that's only ~335px (px-5 on both sides of a 375px
  // screen) - confirmed live as "dashboard mobile is in a bad place."
  // Short forms keep the same real information, just fewer characters.
  const dateLabelLong = now
    ? new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Today';
  const dateLabelShort = now
    ? new Date(now).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Today';

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
      {/* Top identity strip: date + status pill, greeting and day summary
          all stack in one column, with the actions cluster centered
          against that whole three-line block - not paired with just the
          greeting's own line. Used to be two separate flex rows (date+pill
          on its own line above a second items-end row pairing the
          greeting with actions), which meant the actions could only ever
          align to that second row's own height - reading as floating too
          high once the date/pill line above it was counted in, not
          centered on the block as a whole. One row + items-center fixes
          that; min-w-0 on the text column still lets a long business name
          truncate/wrap instead of pushing the actions off-screen. */}
      <div className="mb-6">
        {/* Mobile-only: date + status pill + actions as their own slim,
            single row - matches a reference the user provided directly,
            where that bar is its own thing with nothing else sharing the
            line, and the greeting/heading sits on its own row below it.
            sm: and up keeps the original combined layout further down,
            unchanged - this whole block is mobile-only (sm:hidden). */}
        <div className="flex sm:hidden items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-accent shrink-0">
              {dateLabelShort}
            </span>
            <Link
              href={`/${slug}/admin/billing`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border shrink-0 ${
                acceptingBookings
                  ? 'bg-success-bg text-success border-success-border'
                  : 'bg-warning-bg text-warning border-warning-border'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
              {acceptingBookings ? 'Accepting bookings' : 'Not accepting'}
            </Link>
          </div>
          <div className="shrink-0">
            <DashboardHeaderActions
              slug={slug}
              businessId={businessId}
              services={services}
              maxAdvanceDays={maxAdvanceDays}
            />
          </div>
        </div>
        <div className="sm:hidden mb-5">
          <h1 className="font-display text-h1 text-ink">{now ? `${greeting}, ${businessName}` : businessName}</h1>
          <p className="text-ink-soft text-body-sm mt-1">{daySummary}</p>
        </div>

        {/* Original combined layout - sm: and up only now (was every
            width before the mobile-only split above). */}
        <div className="hidden sm:flex items-center justify-between gap-3">
          <div className="min-w-0">
            {/* Date + status pill get their own short line inside the
                column - always plenty of room for these regardless of
                width, no reason to share a line with the heading. */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Uppercase + tracking-wide, matching the Stitch header's own
                  date treatment ("WEDNESDAY, 24 OCTOBER 2024" in the source). */}
              <span className="text-[12px] font-semibold uppercase tracking-wider text-accent">{dateLabelLong}</span>
              {/* Real status, not decoration (see the server component's own
                  comment on where this comes from) - matches the Stitch
                  dashboard's own header exactly: a permanent status pill,
                  green/"Accepting Online Bookings" in the normal case,
                  switching to the warning treatment on the one day it's
                  actually false. Previously shown only for the abnormal
                  case on the theory that a permanent positive pill was
                  chrome nobody needed to see 365 days a year - reversed on
                  request: this is the Stitch source's own real treatment,
                  confirmed against the generated screenshot, not a
                  fabricated addition. */}
              <Link
                href={`/${slug}/admin/billing`}
                className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium border ${
                  acceptingBookings
                    ? 'bg-success-bg text-success border-success-border'
                    : 'bg-warning-bg text-warning border-warning-border'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                {acceptingBookings ? 'Accepting online bookings' : 'Not accepting bookings'}
              </Link>
            </div>
            <h1 className="font-display text-h1 text-ink mt-1">
              {now ? `${greeting}, ${businessName}` : businessName}
            </h1>
            <p className="text-ink-soft text-body-sm mt-1">{daySummary}</p>
          </div>
          <div className="shrink-0">
            <DashboardHeaderActions
              slug={slug}
              businessId={businessId}
              services={services}
              maxAdvanceDays={maxAdvanceDays}
            />
          </div>
        </div>
      </div>

      {/* lib/whatsappTools.ts's requestOwnerReview - the customer-facing AI
          escalating something it wouldn't guess at, waiting on a real
          reply. Shown above the notifications nudge and setup checklist -
          a real customer waiting on an answer is more urgent than either.
          Renders nothing once there's nothing pending. */}
      {pendingReviews.length > 0 && (
        <div className="mb-6 rounded-xl border border-accent shadow-soft overflow-hidden" style={{ background: 'var(--accent-soft)' }}>
          <div className="px-4 sm:px-5 py-3 border-b border-line flex items-center gap-2">
            <Icon name="priority_high" size={17} className="text-accent" />
            <p className="text-[13px] font-semibold text-ink">
              {pendingReviews.length === 1 ? 'A customer is waiting on your input' : `${pendingReviews.length} customers are waiting on your input`}
            </p>
          </div>
          <div className="divide-y divide-line">
            {pendingReviews.map((r) => (
              <div key={r.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink truncate">{r.customer_label}</p>
                  <p className="text-[13px] text-ink-soft truncate">{r.question}</p>
                </div>
                <button
                  onClick={() => setOpenReview({ customerPhone: r.customer_phone, customerLabel: r.customer_label })}
                  className="shrink-0 inline-flex items-center h-8 rounded-md bg-accent px-3.5 text-[12.5px] font-semibold text-accent-contrast hover:opacity-90 active:scale-95 transition-all"
                >
                  Reply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {openReview && (
        <ConversationPanel
          slug={slug}
          customerPhone={openReview.customerPhone}
          customerLabel={openReview.customerLabel}
          onClose={() => setOpenReview(null)}
        />
      )}

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

          Briefly mixed into --surface instead during this window's color
          pass, reverted back to --paper on request along with
          --admin-canvas-base/--surface-base themselves going back to
          their two-weeks-ago values (see globals.css) - this formula and
          those base values are meant to be read together, not one
          reverted without the other. border-line-strong and shadow-soft
          give it a real edge/lift regardless of how the tint and the
          canvas happen to compare. */}
      {all.length > 0 && (
        <div className="mb-6 sm:mb-8">
          {/* One unified card style at every width now, not a shared strip
              on desktop switching to individual cards on mobile - the
              shared strip broke for real once a value was actually long
              ("Tomorrow 9:30 AM" collided into the next stat's own label,
              confirmed live). grid-cols-4 from sm: up puts all four in one
              row same as the old strip did, just as four separate bordered
              cards instead of one shared card with internal dividers. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Color emphasis matches the Stitch source exactly (confirmed
                against its actual HTML, not just the screenshot): "Next
                up"'s time is plain ink there, not accent - the accent is
                spent on "Today's revenue" instead, the one number on this
                strip actually worth drawing the eye to. Had this backwards
                before - accent on Next up, plain ink on revenue. */}
            <TodayStat
              label="Next up"
              value={nextSlotLabel}
              sub={nextSlot ? `${nextSlot.customer_name} · ${(nextSlot as any).services?.name ?? ''}` : 'Nothing scheduled'}
              color={nextSlot ? 'var(--ink)' : 'var(--ink-faint)'}
              icon="schedule"
            />
            <TodayStat
              label="Today"
              value={String(todayCount)}
              sub={todayCount === 1 ? 'appointment' : 'appointments'}
              icon="calendar_today"
            />
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
              color={todayRevenue > 0 ? 'var(--accent)' : 'var(--ink)'}
              icon="attach_money"
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
              icon="trending_up"
            />
          </div>
          {/* Today's revenue/This week above are the VALUE of what's
              booked (every active booking's full service price) - a
              business taking a 10% deposit, or one that collects in
              person, was reading as if the full price had already come
              in. Confirmed live: "shouldn't there be something that
              shows how much [was collected] from deposits and full
              payments?" This is that - a real, separate figure, summed
              from the actual verified Flutterwave amount rather than the
              service's list price. Only shows once there's genuinely
              something to report (no permanent empty line for a business
              that doesn't take online payments at all, or hasn't yet
              today). */}
          {(todayCollected > 0 || weekCollected > 0) && (
            // Sub-summary strip, matching the Stitch design's own treatment:
            // its own tinted band under the stat grid, a small icon leading
            // the line, and a link+chevron on the right. That link goes to
            // Settings, where PaymentsManager (the actual Flutterwave
            // account screen) lives - "View payout ledger" was Stitch's
            // placeholder copy for a ledger page this app doesn't have;
            // linking it to a real screen instead of a dead end.
            // Plain bg-warm-surface, not a /NN opacity modifier - this app's
            // surface tokens are CSS custom properties, and Tailwind can't
            // decompose a var() reference into RGB channels at build time,
            // so an opacity suffix here would silently produce no tint at
            // all (documented earlier this session). warm-surface is
            // already the right strength on its own.
            // Self-contained rounded strip now, not negative margins
            // calibrated to bleed into an outer card's own padding/corners
            // - that outer card is gone (see above), so -mx-5/-mb-5/
            // rounded-b-xl would have pulled this out of its own layout
            // with nothing left to cancel against.
            <div className="mt-3 rounded-xl border border-line-strong bg-warm-surface px-5 py-3 flex items-start justify-between gap-3 flex-wrap">
              {/* Plain span, not inline-flex - an inline-flex won't let the
                  text line-wrap, so on a phone this sentence either
                  overflowed or squashed. The icon rides along via
                  align-middle. */}
              <span className="text-caption text-ink-faint">
                <Icon name="payments" size={15} className="text-accent mr-1.5 align-[-2px]" />
                Collected via Vanova (deposits + full payments) —{' '}
                <strong className="font-semibold text-ink whitespace-nowrap">{formatMoney(todayCollected)} today</strong> ·{' '}
                <strong className="font-semibold text-ink whitespace-nowrap">{formatMoney(weekCollected)} this week</strong>
              </span>
              <Link
                href={`/${slug}/admin/settings`}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline shrink-0"
              >
                Payment settings
                <Icon name="chevron_right" size={14} />
              </Link>
            </div>
          )}
        </div>
      )}

      {all.length === 0 ? (
        <div className="border border-line rounded-xl bg-warm-surface p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-14 w-14 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
            <Icon name="calendar_today" size={26} />
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
        <BookingsList slug={slug} bookings={all} search={search} onSearchChange={setSearch} />
      )}
    </div>
  );
}
