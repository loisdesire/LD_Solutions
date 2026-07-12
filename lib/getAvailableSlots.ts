import { createClient } from '@supabase/supabase-js';
import { todayInTimezone, dayOfWeekForDate, daysBetween, zonedTimeToUtc } from './timezone';
import { generateSlots } from './slotGenerator';

// Service role: this file only ever runs server-side (from
// /api/availability), and needs to read `bookings` (staff-only under RLS)
// to actually check for conflicts, and `booking_rules` (also staff-only)
// to apply buffer/advance-window settings.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Given a business, a service, and a date, work out which time slots are
// actually free — this is what real availability logic looks like, instead
// of letting a customer type any date/time they want.
export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  dateISO: string // e.g. '2026-07-15' — a calendar date in the business's own timezone
) {
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('timezone')
    .eq('id', businessId)
    .single();

  const timeZone = business?.timezone || 'UTC';
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
  return generateSlots({
    dateISO,
    timeZone,
    hours,
    durationMinutes: service.duration_minutes,
    bufferMinutes,
    booked: existingBookings ?? [],
  });
}
