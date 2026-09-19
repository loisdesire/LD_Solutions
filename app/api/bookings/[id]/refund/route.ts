import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { refundTransaction } from '@/lib/flutterwave';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

// POST /api/bookings/[id]/refund - the real fix for a genuine gap: a
// cancellation only ever set status='cancelled', nothing ever touched
// Flutterwave to actually reverse a charge. Owner-only (moves real
// money), full-amount only for v1 - see refundTransaction's own comment
// on why partial isn't exposed yet.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await rateLimit(`bookings-refund:${getClientIp(req)}`, 10, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const slug = body?.slug as string | undefined;
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id, name', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  // refund_status isn't selected here on purpose - a database that hasn't
  // run the migration yet still gets a real, working refund on its first
  // attempt, it just can't remember it happened afterward (see
  // schema.sql's own comment). The update below degrades the same way,
  // via isMissingColumnError.
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, payment_status, amount_paid, payment_currency, payment_reference')
    .eq('id', id)
    .eq('business_id', business.id)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.payment_status !== 'paid' || !booking.payment_reference) {
    return NextResponse.json({ error: 'This booking has no completed payment to refund.' }, { status: 400 });
  }

  const result = await refundTransaction(booking.payment_reference);
  if (!result.ok) {
    logError('api/bookings/refund', new Error(result.error), { bookingId: id, businessId: business.id }, { critical: true });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ refund_status: 'completed', refunded_amount: booking.amount_paid, refunded_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError && !isMissingColumnError(updateError)) {
    logError('api/bookings/refund:record', updateError, { bookingId: id, businessId: business.id });
  }

  return NextResponse.json({ ok: true, amount: booking.amount_paid, currency: booking.payment_currency });
}
