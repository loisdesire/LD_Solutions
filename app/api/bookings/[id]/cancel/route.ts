import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { isUuid } from '@/lib/apiValidation';
import { notifyStaffOfCancellation } from '@/lib/pushNotify';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/bookings/[id]/cancel - self-serve cancellation. No login: the
// booking id itself (an unguessable UUID, only ever shown/emailed to the
// customer who made it) is the "secret" that authorizes this, the same
// pattern most booking tools use for cancel/reschedule links.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await rateLimit(`cancel:${getClientIp(req)}`, 10, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id, start_time, status, customer_name, services(name), businesses(timezone)')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.status === 'cancelled') {
    return NextResponse.json({ error: 'Booking not found or already cancelled' }, { status: 404 });
  }

  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('cancellation_window_hours')
    .eq('business_id', existing.business_id)
    .maybeSingle();

  const windowHours = rules?.cancellation_window_hours ?? 24;
  const hoursUntilStart = (new Date(existing.start_time).getTime() - Date.now()) / 3600000;

  if (hoursUntilStart < windowHours) {
    return NextResponse.json(
      { error: `This booking can only be cancelled at least ${windowHours} hours in advance` },
      { status: 403 }
    );
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // The raw Postgres message used to go straight to the customer on the
    // public manage-booking page. It's already logged with full detail
    // above; the customer gets something they can act on instead.
    logError('api/bookings/cancel:update', error, { bookingId: id });
    return NextResponse.json(
      { error: "We couldn't cancel that booking. Please try again, or contact the business directly." },
      { status: 400 }
    );
  }

  // Never blocks the cancellation itself if it fails - this used to be a
  // real gap: a customer cancelling had no way to tell the business at
  // all except them noticing it missing from the calendar eventually.
  try {
    const service = (Array.isArray(existing.services) ? existing.services[0] : existing.services) as { name: string } | null;
    const biz = (Array.isArray(existing.businesses) ? existing.businesses[0] : existing.businesses) as { timezone: string } | null;
    await notifyStaffOfCancellation(existing.business_id, {
      customerName: existing.customer_name,
      serviceName: service?.name ?? 'Appointment',
      whenLabel: new Date(existing.start_time).toLocaleString('en-US', {
        timeZone: biz?.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'short',
      }),
      cancelledBy: 'customer',
    });
  } catch (err) {
    logError('api/bookings/cancel:notify', err, { bookingId: id });
  }

  return NextResponse.json({ booking });
}
