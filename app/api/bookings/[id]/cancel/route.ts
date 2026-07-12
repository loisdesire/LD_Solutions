import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/bookings/[id]/cancel — self-serve cancellation. No login: the
// booking id itself (an unguessable UUID, only ever shown/emailed to the
// customer who made it) is the "secret" that authorizes this, the same
// pattern most booking tools use for cancel/reschedule links.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!rateLimit(`cancel:${getClientIp(req)}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { id } = await params;

  const { data: existing } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id, start_time, status')
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
    logError('api/bookings/cancel:update', error, { bookingId: id });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ booking });
}
