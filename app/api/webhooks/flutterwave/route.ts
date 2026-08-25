import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logError } from '@/lib/logger';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/webhooks/flutterwave - Flutterwave calls this on every payment
// event (initial subscribe, each monthly renewal, failures). Verified via
// the `verif-hash` header, which must match the secret hash configured in
// the Flutterwave dashboard's webhook settings (Settings → Webhooks) - NOT
// the same thing as the secret API key.
export async function POST(req: NextRequest) {
  // This is the one webhook in the app that had no rate limit at all, on a
  // route that also compared its secret with plain string inequality -
  // together, an unlimited number of timed guesses at the real secret.
  // Same budget as the other webhooks.
  if (!rateLimit(`webhook:flutterwave:${getClientIp(req)}`, 30, 60_000)) {
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
