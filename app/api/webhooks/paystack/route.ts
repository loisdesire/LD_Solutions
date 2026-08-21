import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { confirmPaidBooking } from '@/lib/whatsappTools';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/webhooks/paystack — confirms a chat booking the moment its
// payment lands, instead of waiting for the customer to say "I've paid".
//
// The signature ordering here is the whole security story and is easy to
// get backwards. Paystack signs with the SECRET KEY OF THE ACCOUNT THAT
// SENT IT, and every business connects their own Paystack account — so
// there is no single key to verify against. We cannot know which key to
// use until we know which business, and we cannot know that without
// reading a payload we have not verified yet.
//
// So: parse the body as strictly untrusted, use it only to look up which
// booking it claims to be about, fetch that business's own secret, and
// only then verify the signature. Nothing is acted on before that check
// passes. The untrusted read is a lookup key and nothing else — no amount,
// no status, no customer data from it is ever believed.
export async function POST(req: NextRequest) {
  const raw = await req.text();

  let payload: { event?: string; data?: { reference?: string; metadata?: { booking_id?: string } } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }

  const bookingId = payload.data?.metadata?.booking_id;
  const reference = payload.data?.reference;
  if (!bookingId || !reference) {
    // Nothing actionable — 200 so Paystack stops retrying a payload we
    // will never be able to route.
    return NextResponse.json({ ok: true, ignored: 'no booking metadata' });
  }

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ ok: true, ignored: 'unknown booking' });

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('paystack_secret_key')
    .eq('id', booking.business_id)
    .single();

  if (!business?.paystack_secret_key) {
    return NextResponse.json({ ok: true, ignored: 'business has no paystack key' });
  }

  // Now — and only now — verify this actually came from that business's
  // Paystack account. timingSafeEqual over a length check, so a mismatched
  // length can't throw and can't leak position via timing.
  const expected = crypto
    .createHmac('sha512', business.paystack_secret_key)
    .update(raw)
    .digest('hex');
  const got = req.headers.get('x-paystack-signature') ?? '';

  const valid =
    got.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));

  if (!valid) {
    logError('api/webhooks/paystack:bad-signature', new Error('signature mismatch'), {
      businessId: booking.business_id,
      bookingId,
    });
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  if (payload.event !== 'charge.success') {
    return NextResponse.json({ ok: true, ignored: payload.event });
  }

  // confirmPaidBooking re-verifies the amount against Paystack directly
  // rather than trusting anything in this payload, and is idempotent, so a
  // retry or a duplicate payment cannot double-confirm.
  const result = await confirmPaidBooking(bookingId, reference);

  if (!result.confirmed && result.reason === 'slot_taken') {
    logError('api/webhooks/paystack:paid-slot-lost', new Error('paid after hold expired'), {
      businessId: booking.business_id,
      bookingId,
    });
  }

  return NextResponse.json({ ok: true, confirmed: result.confirmed, reason: result.reason });
}
