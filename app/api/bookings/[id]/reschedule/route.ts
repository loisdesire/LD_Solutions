import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { todayInTimezone, daysBetween } from '@/lib/timezone';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/bookings/[id]/reschedule — same trust model as cancel: the
// booking id is the secret. Re-validates the new slot against other
// bookings so rescheduling can't create a double-booking.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!rateLimit(`reschedule:${getClientIp(req)}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { id } = await params;
  const { newStartTime } = await req.json();

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id, service_id, status, start_time, services(duration_minutes)')
    .eq('id', id)
    .maybeSingle();

  if (!booking || booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Booking not found or already cancelled' }, { status: 404 });
  }

  const [{ data: rules }, { data: business }] = await Promise.all([
    supabaseAdmin
      .from('booking_rules')
      .select('buffer_minutes, max_advance_days, cancellation_window_hours')
      .eq('business_id', booking.business_id)
      .maybeSingle(),
    supabaseAdmin.from('businesses').select('timezone').eq('id', booking.business_id).single(),
  ]);

  const timeZone = business?.timezone || 'UTC';
  const bufferMinutes = rules?.buffer_minutes ?? 0;
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
  const newStart = new Date(newStartTime);
  const newEnd = new Date(newStart.getTime() + duration * 60000);

  const today = todayInTimezone(timeZone);
  const newStartDateInTz = new Intl.DateTimeFormat('en-CA', { timeZone }).format(newStart);
  const daysOut = daysBetween(today, newStartDateInTz);

  if (daysOut < 0 || daysOut > maxAdvanceDays) {
    return NextResponse.json({ error: 'That date is not available for booking' }, { status: 400 });
  }

  const { data: others } = await supabaseAdmin
    .from('bookings')
    .select('start_time, end_time')
    .eq('business_id', booking.business_id)
    .neq('id', id)
    .neq('status', 'cancelled');

  const overlaps = (others ?? []).some((b) => {
    const bStart = new Date(new Date(b.start_time).getTime() - bufferMinutes * 60000);
    const bEnd = new Date(new Date(b.end_time).getTime() + bufferMinutes * 60000);
    return newStart < bEnd && newEnd > bStart;
  });

  if (overlaps) {
    return NextResponse.json({ error: 'That time is no longer available' }, { status: 409 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('bookings')
    .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Same DB-level backstop as booking creation — closes the race
    // condition the pre-check above can't fully rule out on its own.
    if ((error as { code?: string }).code === '23P01') {
      return NextResponse.json({ error: 'That time is no longer available' }, { status: 409 });
    }
    logError('api/bookings/reschedule:update', error, { bookingId: id });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ booking: updated });
}
