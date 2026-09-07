import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logError } from '@/lib/logger';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { confirmPaidBooking } from '@/lib/whatsappTools';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A chat booking's payment hold mints its tx_ref as `chat_<bookingId>_
// <random>` (lib/whatsappTools.ts's createBooking tool) specifically so
// this webhook can recover which booking a payment belongs to without a
// second round trip - Flutterwave does echo back whatever `meta` was sent
// at checkout, but the ref itself is simpler and is already how the
// booking's own payment_reference column stores it, so this matches
// against the same string confirmPaidBooking's own idempotency check
// already uses. The web booking flow's tx_ref (`web_<uuid>`, no booking
// id embedded) never matches this pattern by design - unlike chat, a web
// booking doesn't exist yet when payment starts (see BookingForm.tsx),
// so there's nothing here for a webhook to confirm; that flow verifies
// synchronously in the same request that creates the booking instead
// (app/api/bookings/route.ts).
const CHAT_BOOKING_TX_REF = /^chat_([0-9a-f-]{36})_/;

// POST /api/webhooks/flutterwave - Flutterwave calls this on every payment
// event: platform subscription checkouts/renewals/failures, AND now chat
// booking deposits (confirms the booking the moment payment lands,
// instead of waiting for the customer to say "I've paid" - same job the
// old Paystack webhook did, see git history). Verified via the
// `verif-hash` header, which must match the secret hash configured in
// the Flutterwave dashboard's webhook settings (Settings → Webhooks) - NOT
// the same thing as the secret API key.
export async function POST(req: NextRequest) {
  // This is the one webhook in the app that had no rate limit at all, on a
  // route that also compared its secret with plain string inequality -
  // together, an unlimited number of timed guesses at the real secret.
  // Same budget as the other webhooks.
  if (!(await rateLimit(`webhook:flutterwave:${getClientIp(req)}`, 30, 60_000))) {
    return new NextResponse('Too many requests', { status: 429 });
  }

  const signature = req.headers.get('verif-hash');
  const expected = process.env.FLUTTERWAVE_SECRET_HASH ?? '';
  // Constant-time compare, same reasoning as the Paystack webhook: a plain
  // !== short-circuits on the first differing byte, which leaks how many
  // leading characters an attacker's guess got right through response
  // timing. Length is checked first because timingSafeEqual throws (rather
  // than just returning false) on a length mismatch.
  const signatureBuf = Buffer.from(signature ?? '');
  const expectedBuf = Buffer.from(expected);
  const valid =
    signature != null &&
    expected.length > 0 &&
    signatureBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(signatureBuf, expectedBuf);
  if (!valid) {
    logError('api/webhooks/flutterwave:signature', new Error('Invalid Flutterwave webhook signature'));
    return new NextResponse('Forbidden', { status: 403 });
  }

  const payload = await req.json();
  const data = payload.data;
  const txRef: string | undefined = data?.tx_ref;
  const flwSubId: string | undefined = data?.flw_ref ?? (data?.id != null ? String(data.id) : undefined);

  // Booking-deposit path - checked first since it's cheap to rule out
  // (a regex, no query) and completely unrelated to subscriptions below.
  const chatBookingMatch = txRef?.match(CHAT_BOOKING_TX_REF);
  if (chatBookingMatch) {
    const bookingId = chatBookingMatch[1];
    // confirmPaidBooking re-verifies the amount against Flutterwave
    // directly rather than trusting anything in this payload, and is
    // idempotent, so a retry or a duplicate delivery can't double-confirm.
    const result = await confirmPaidBooking(bookingId, txRef!);
    if (!result.confirmed && result.reason === 'slot_taken') {
      logError('api/webhooks/flutterwave:paid-slot-lost', new Error('paid after hold expired'), { bookingId });
    }
    return NextResponse.json({ ok: true, confirmed: result.confirmed, reason: result.reason });
  }

  // The initial checkout matches by the tx_ref we generated and stored.
  // Renewal charges on a recurring plan come through with a NEW tx_ref
  // each cycle (not the original one), so those only match by the
  // subscription id Flutterwave assigned after the first successful
  // charge - this second lookup is unverified against a real renewal
  // payload (that can't happen until a full month has passed) and may
  // need adjusting once one actually lands; check logs after the first
  // renewal to confirm this matches.
  let sub: { id: string; business_id: string } | null = null;
  if (txRef) {
    const { data: byRef } = await supabaseAdmin
      .from('subscriptions')
      .select('id, business_id')
      .eq('flw_tx_ref', txRef)
      .maybeSingle();
    sub = byRef;
  }
  if (!sub && flwSubId) {
    const { data: bySubId } = await supabaseAdmin
      .from('subscriptions')
      .select('id, business_id')
      .eq('flw_subscription_id', flwSubId)
      .maybeSingle();
    sub = bySubId;
  }

  if (!sub) {
    logError('api/webhooks/flutterwave:no-match', new Error('No subscription for this event'), {
      txRef,
      flwSubId,
    });
    return NextResponse.json({ ok: true });
  }

  await supabaseAdmin.from('payment_history').insert({
    business_id: sub.business_id,
    amount: data.amount ?? null,
    status: data.status === 'successful' ? 'successful' : 'failed',
    flw_tx_ref: txRef ?? null,
  });

  if (data.status === 'successful') {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        flw_subscription_id: flwSubId ?? null,
        updated_at: new Date().toISOString(),
        // Reset, not left set - a business that recovers from one failed
        // payment and then fails a LATER one should still get warned about
        // that new failure, not silently skipped because the tracking
        // column was already set from the first time.
        past_due_warning_sent_at: null,
      })
      .eq('id', sub.id);
  } else if (data.status === 'failed') {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('id', sub.id);
  }

  return NextResponse.json({ ok: true });
}
