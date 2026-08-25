import { createClient } from '@supabase/supabase-js';
import { todayInTimezone, dayOfWeekForDate, daysBetween, zonedTimeToUtc } from './timezone';
import { getBusinessTimezone } from './getBusinessTimezone';
import { generateSlots } from './slotGenerator';

// Service role: this file only ever runs server-side (from
// /api/availability), and needs to read `bookings` (staff-only under RLS)
// to actually check for conflicts, and `booking_rules` (also staff-only)
// to apply buffer/advance-window settings.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A chat booking awaiting payment sits at status 'pending_payment', which
// the no_overlapping_bookings constraint treats like any other live
// booking - deliberately, since that's what holds the slot while the
// customer pays. The flip side is that an abandoned payment would hold it
// forever, so holds carry an expiry and get released here.
//
// Swept lazily on the availability read rather than by a cron: it runs
// exactly when the answer matters, needs no scheduler that can silently
// stop, and self-heals. Cancelling (rather than deleting) keeps the
// attempt visible to the business and leaves a row for a late webhook to
// find, which is what makes the paid-too-late case recoverable.
async function expireStalePaymentHolds(businessId: string) {
  await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled', payment_status: 'expired' })
    .eq('business_id', businessId)
    .eq('status', 'pending_payment')
    .lt('payment_expires_at', new Date().toISOString());
}

// Given a business, a service, and a date, work out which time slots are
// actually free - this is what real availability logic looks like, instead
// of letting a customer type any date/time they want.
export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  dateISO: string // e.g. '2026-07-15' - a calendar date in the business's own timezone
) {
  await expireStalePaymentHolds(businessId);

  const timeZone = await getBusinessTimezone(businessId);
  const dayOfWeek = dayOfWeekForDate(dateISO);

  // 1. Get the service duration
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single();

  if (!service) return [];

  // 2. Get the business's booking rules, and bail out early if the
  // requested date is beyond how far ahead this business allows booking
  // (measured in the business's own timezone, not the server's).
  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('buffer_minutes, max_advance_days')
    .eq('business_id', businessId)
    .maybeSingle();

  const bufferMinutes = rules?.buffer_minutes ?? 0;
  const maxAdvanceDays = rules?.max_advance_days ?? 30;

  const today = todayInTimezone(timeZone);
  const daysOut = daysBetween(today, dateISO);

  if (daysOut < 0 || daysOut > maxAdvanceDays) return [];

  // 3. Get working hours for this business on this day of week
  const { data: hours } = await supabaseAdmin
    .from('availability')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .eq('day_of_week', dayOfWeek);

  if (!hours || hours.length === 0) return []; // closed that day

  // 4. Get existing bookings for that date, so we don't double-book. Widen
  // the UTC range slightly since a business's calendar day doesn't line up
  // with the UTC calendar day once timezones are involved.
  const dayStart = zonedTimeToUtc(dateISO, '00:00', timeZone);
  const dayEnd = new Date(dayStart.getTime() + 36 * 3600000); // 36h covers any timezone's full day + margin

  const { data: existingBookings } = await supabaseAdmin
    .from('bookings')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString());

  // 5. Generate candidate slots and filter out anything that overlaps an
  // existing booking (expanded by the buffer on each side).
  const slots = generateSlots({
    dateISO,
    timeZone,
    hours,
    durationMinutes: service.duration_minutes,
    bufferMinutes,
    booked: existingBookings ?? [],
  });

  // generateSlots only knows about the calendar date, not the clock - it'll
  // happily hand back 9am as "available" at 8pm the same day, since nothing
  // upstream excludes a date-that's-today from also being time-that's-past.
  // Slot start times are already real UTC instants, so this comparison is
  // correct regardless of the business's timezone.
  const now = Date.now();
  return slots.filter((iso) => new Date(iso).getTime() > now);
}

function addDaysToDateStr(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Every enabled date on the calendar used to look identically bookable -
// a customer had no way to tell "closed" or "fully booked" from "wide
// open" without clicking in and waiting for that date's slots to load,
// one date at a time. This answers "does this date have ANY open slot"
// for a whole visible range in one call, without the N+1 that would come
// from just calling getAvailableSlots once per day: working hours and
// bookings are each fetched ONCE for the whole range, then the same
// generateSlots logic that powers a single day's real availability runs
// in memory per date. generateSlots compares absolute UTC instants, so
// handing it every booking in the range (not just that day's) is safe -
// a booking on another day can never overlap a candidate slot on this
// one.
//
// Capped at 42 days (a full 6-week month grid, the largest range
// CalendarPicker's month view ever needs) so a crafted start/end can't
// force this into computing months of slots in one request.
const MAX_RANGE_DAYS = 42;

export async function getAvailabilityForRange(
  businessId: string,
  serviceId: string,
  startISO: string,
  endISO: string
): Promise<Record<string, boolean>> {
  await expireStalePaymentHolds(businessId);

  const timeZone = await getBusinessTimezone(businessId);

  const { data: service } = await supabaseAdmin
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single();

  if (!service) return {};

  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('buffer_minutes, max_advance_days')
    .eq('business_id', businessId)
    .maybeSingle();

  const bufferMinutes = rules?.buffer_minutes ?? 0;
  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  const today = todayInTimezone(timeZone);

  // Build the actual list of dates to answer for, clamped to the same
  // 42-day ceiling regardless of what the caller asked for.
  const dates: string[] = [];
  let cursor = startISO;
  while (cursor <= endISO && dates.length < MAX_RANGE_DAYS) {
    dates.push(cursor);
    cursor = addDaysToDateStr(cursor, 1);
  }

  const result: Record<string, boolean> = {};
  const bookableDates = dates.filter((d) => {
    const daysOut = daysBetween(today, d);
    if (daysOut < 0 || daysOut > maxAdvanceDays) {
      result[d] = false;
      return false;
    }
    return true;
  });

  if (bookableDates.length === 0) return result;

  // All seven days of week in one query, not one query per date - most
  // date ranges only span 1-2 distinct days-of-week's worth of variation
  // anyway (a week or month grid repeats Mon-Sun), so this is the whole
  // working-hours picture in a single round trip.
  const { data: allHours } = await supabaseAdmin
    .from('availability')
    .select('day_of_week, start_time, end_time')
    .eq('business_id', businessId);

  const hoursByDow = new Map<number, { start_time: string; end_time: string }[]>();
  for (const h of allHours ?? []) {
    const list = hoursByDow.get(h.day_of_week) ?? [];
    list.push({ start_time: h.start_time, end_time: h.end_time });
    hoursByDow.set(h.day_of_week, list);
  }

  // One bookings query spanning the whole range, widened by the same 36h
  // margin getAvailableSlots uses per-day (a business's calendar day
  // doesn't line up with the UTC day once timezones are involved).
  const rangeStart = zonedTimeToUtc(bookableDates[0], '00:00', timeZone);
  const rangeEnd = new Date(
    zonedTimeToUtc(bookableDates[bookableDates.length - 1], '00:00', timeZone).getTime() + 36 * 3600000
  );

  const { data: allBookings } = await supabaseAdmin
    .from('bookings')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .gte('start_time', rangeStart.toISOString())
    .lte('start_time', rangeEnd.toISOString());

  const now = Date.now();
  for (const d of bookableDates) {
    const hours = hoursByDow.get(dayOfWeekForDate(d)) ?? [];
    if (hours.length === 0) {
      result[d] = false;
      continue;
    }
    const slots = generateSlots({
      dateISO: d,
      timeZone,
      hours,
      durationMinutes: service.duration_minutes,
      bufferMinutes,
      booked: allBookings ?? [],
    });
    result[d] = slots.some((iso) => new Date(iso).getTime() > now);
  }

  return result;
}
