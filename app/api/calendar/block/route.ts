import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

// Blocked time = a slice of the calendar an owner marks unavailable that
// isn't a customer booking (lunch, a day off, a holiday). Its own table
// (supabase/schema.sql blocked_times), read back on the Calendar page and
// - the part that actually matters - subtracted from customer-facing
// availability in lib/getAvailableSlots.ts + lib/assignStaff.ts.
//
// Service role for the write: same as every other admin mutation that
// goes straight to Supabase. requireStaffApiSession is the real gate
// (and auto-rejects the demo viewer on any non-GET).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A block can't be longer than this - a genuine "closed all week" case is
// a hours change, not a block, and an unbounded range is the kind of
// thing a fat-fingered date entry produces.
const MAX_BLOCK_DAYS = 31;

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`calendar-block:${getClientIp(req)}`, 40, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { slug, startTime, endTime, staffId, reason } = (body ?? {}) as Record<string, unknown>;

  if (typeof slug !== 'string' || typeof startTime !== 'string' || typeof endTime !== 'string') {
    return NextResponse.json({ error: 'Missing slug, startTime, or endTime' }, { status: 400 });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'That start and end time don\'t make sense.' }, { status: 400 });
  }
  if (end.getTime() - start.getTime() > MAX_BLOCK_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: `A single block can't be longer than ${MAX_BLOCK_DAYS} days.` }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id');
  if (auth.error) return auth.error;

  // A staffId, when given, must actually belong to this business - never
  // trust an id straight off the request body against a service-role write.
  let validStaffId: string | null = null;
  if (typeof staffId === 'string' && staffId) {
    const { data: staffRow } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('id', staffId)
      .eq('business_id', auth.business.id)
      .maybeSingle();
    if (!staffRow) return NextResponse.json({ error: 'That staff member isn\'t part of this business.' }, { status: 400 });
    validStaffId = staffRow.id;
  }

  const cleanReason =
    typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 120) : null;

  const { data: block, error } = await supabaseAdmin
    .from('blocked_times')
    .insert({
      business_id: auth.business.id,
      staff_id: validStaffId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      reason: cleanReason,
    })
    .select('id, staff_id, start_time, end_time, reason')
    .single();

  if (error) {
    logError('api/calendar/block:insert', error, { businessId: auth.business.id });
    return NextResponse.json({ error: 'Couldn\'t save that block. Please try again.' }, { status: 500 });
  }

  // Blocking time subtracts from FUTURE availability - it never touches a
  // booking that already exists. Confirmed live: an owner blocked a window
  // that already had real bookings sitting in it, and nothing about those
  // bookings changed - correct (auto-cancelling someone's paid appointment
  // because the owner blocked over it would be a much worse surprise), but
  // silently correct isn't good enough - the owner has no way to know
  // there's a real conflict to go handle (call the customer, reschedule,
  // refund) unless it's surfaced here. Scoped to the same staff the block
  // covers (or every staff, for a business-wide block) and only the
  // booking states that still represent a real appointment.
  const conflictQuery = supabaseAdmin
    .from('bookings')
    .select('id, customer_name, start_time')
    .eq('business_id', auth.business.id)
    .in('status', ['confirmed', 'pending_payment'])
    .lt('start_time', end.toISOString())
    .gt('end_time', start.toISOString());
  if (validStaffId) conflictQuery.eq('staff_id', validStaffId);
  const { data: conflicts } = await conflictQuery;

  return NextResponse.json({ block, conflicts: conflicts ?? [] });
}

export async function DELETE(req: NextRequest) {
  if (!(await rateLimit(`calendar-block:${getClientIp(req)}`, 40, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug');
  const id = req.nextUrl.searchParams.get('id');
  if (!slug || !id) {
    return NextResponse.json({ error: 'Missing slug or id' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id');
  if (auth.error) return auth.error;

  // Scoped to this business's own id - a block belonging to another
  // business is simply not found here, never deleted.
  const { error } = await supabaseAdmin
    .from('blocked_times')
    .delete()
    .eq('id', id)
    .eq('business_id', auth.business.id);

  if (error) {
    logError('api/calendar/block:delete', error, { businessId: auth.business.id });
    return NextResponse.json({ error: 'Couldn\'t remove that block. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
