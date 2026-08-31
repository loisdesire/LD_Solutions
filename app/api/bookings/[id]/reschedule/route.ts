import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { todayInTimezone, daysBetween } from '@/lib/timezone';
import { getBusinessTimezone } from '@/lib/getBusinessTimezone';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { cleanIsoInstant, isUuid } from '@/lib/apiValidation';
import { getAvailableSlots } from '@/lib/getAvailableSlots';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/bookings/[id]/reschedule - same trust model as cancel: the
// booking id is the secret. Re-validates the new slot against other
// bookings so rescheduling can't create a double-booking.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await rateLimit(`reschedule:${getClientIp(req)}`, 10, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const validStartTime = cleanIsoInstant(body.newStartTime);
  if (!validStartTime) {
    return NextResponse.json({ error: 'That is not a valid time' }, { status: 400 });
  }

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id, service_id, status, start_time, services(duration_minutes)')
    .eq('id', id)
    .maybeSingle();

  if (!booking || booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Booking not found or already cancelled' }, { status: 404 });
  }

  const [{ data: rules }, timeZone] = await Promise.all([
    supabaseAdmin
      .from('booking_rules')
      .select('buffer_minutes, max_advance_days, cancellation_window_hours')
      .eq('business_id', booking.business_id)
      .maybeSingle(),
    getBusinessTimezone(booking.business_id),
  ]);

  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  const windowHours = rules?.cancellation_window_hours ?? 24;

  // Same protection as cancelling: don't let a booking that's about to
  // start get shuffled around at the last minute.
  const hoursUntilStart = (new Date(booking.start_time).getTime() - Date.now()) / 3600000;
  if (hoursUntilStart < windowHours) {
    return NextResponse.json(
      { error: `This booking can only be rescheduled at least ${windowHours} hours in advance` },
      { status: 403 }
    );
  }

  const duration = (booking.services as any)?.duration_minutes ?? 30;
  const newStart = new Date(validStartTime);
  const newEnd = new Date(newStart.getTime() + duration * 60000);

  const today = todayInTimezone(timeZone);
  const newStartDateInTz = new Intl.DateTimeFormat('en-CA', { timeZone }).format(newStart);
  const daysOut = daysBetween(today, newStartDateInTz);

  if (daysOut < 0 || daysOut > maxAdvanceDays) {
    return NextResponse.json({ error: 'That date is not available for booking' }, { status: 400 });
  }

  // getAvailableSlots is the real check - it's already staff-capacity
  // aware (see lib/slotGenerator.ts) and already excludes this exact
  // booking via excludeBookingId, so it correctly answers "is there
  // actually room" for a multi-staff business, not just "is the whole
  // business clear". A second, cruder overlap check used to run right
  // after this one - unlike this one, staff-blind, so in a multi-staff
  // business it could reject a reschedule this check had just approved,
  // purely because some unrelated staff member had a booking at the
  // overlapping time. Removed rather than staff-scoped: it was fully
  // redundant with this check once this one became capacity-aware.
  const realSlots = await getAvailableSlots(booking.business_id, booking.service_id, newStartDateInTz, id);
  if (!realSlots.some((slot) => new Date(slot).getTime() === newStart.getTime())) {
    return NextResponse.json({ error: 'That time is outside opening hours or no longer available' }, { status: 409 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('bookings')
    .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Same DB-level backstop as booking creation - closes the race
    // condition the pre-check above can't fully rule out on its own.
    if ((error as { code?: string }).code === '23P01') {
      return NextResponse.json({ error: 'That time is no longer available' }, { status: 409 });
    }
    logError('api/bookings/reschedule:update', error, { bookingId: id });
    return NextResponse.json(
      { error: "We couldn't move that booking. Please try again, or contact the business directly." },
      { status: 400 }
    );
  }

  return NextResponse.json({ booking: updated });
}
