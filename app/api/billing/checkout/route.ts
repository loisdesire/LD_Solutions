import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { PLAN_PRICE_NGN, PLAN_LABEL, type Plan } from '@/lib/subscription';
import { SITE_URL } from '@/lib/site';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Each plan needs its own Payment Plan created by hand in the Flutterwave
// dashboard (Recurring Payments → Payment Plans) - same one-time manual
// step as before, just one more of them. We don't create plans
// dynamically here, since re-running that on every deploy risks
// duplicate plans.
const PLAN_ENV_KEY: Record<Plan, string> = {
  core: 'FLUTTERWAVE_PLAN_ID',
  business_intelligence: 'FLUTTERWAVE_PLAN_ID_BI',
};

// POST /api/billing/checkout - starts a Flutterwave subscription checkout
// for this business, for whichever plan they picked.
export async function POST(req: NextRequest) {
  const { slug, plan: rawPlan } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const plan: Plan = rawPlan === 'business_intelligence' ? 'business_intelligence' : 'core';
  const flwPlanId = process.env[PLAN_ENV_KEY[plan]];

  if (!process.env.FLUTTERWAVE_SECRET_KEY || !flwPlanId) {
    return NextResponse.json(
      { error: `The ${PLAN_LABEL[plan]} plan isn't fully set up yet - missing its Flutterwave plan ID.` },
      { status: 503 }
    );
  }

  const auth = await requireStaffApiSession(req, slug, 'id, name', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  const { data: staffRow } = await supabaseAdmin
    .from('staff')
    .select('email')
    .eq('business_id', business.id)
    .eq('role', 'owner')
    .maybeSingle();

  const txRef = `sub_${business.id}_${randomUUID()}`;

  const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: String(PLAN_PRICE_NGN[plan]),
      currency: 'NGN',
      redirect_url: `${SITE_URL}/${slug}/admin/billing`,
      payment_plan: flwPlanId,
      customer: {
        email: staffRow?.email ?? undefined,
        name: business.name,
      },
      customizations: {
        title: `${business.name} - ${PLAN_LABEL[plan]} subscription`,
        description: 'Monthly platform access',
      },
    }),
  }).catch((err) => {
    logError('api/billing/checkout:fetch', err, { businessId: business.id });
    return null;
  });

  const flwData = flwRes ? await flwRes.json().catch(() => null) : null;

  if (!flwData || flwData.status !== 'success' || !flwData.data?.link) {
    logError('api/billing/checkout:flutterwave', new Error(JSON.stringify(flwData)), {
      businessId: business.id,
    });
    return NextResponse.json({ error: 'Could not start checkout. Please try again shortly.' }, { status: 502 });
  }

  // Record the tx_ref now so the webhook (which only knows the tx_ref, not
  // which business initiated it) can match this payment back to a business
  // when it lands. `plan` is set here too, optimistically, ahead of actual
  // payment confirmation - safe to do because it never gates access on its
  // own, only which features are unlocked once `status`/`current_period_end`
  // already say the business has access. A failed payment just leaves
  // status wherever it already was.
  const { error: updateError } = await supabaseAdmin
    .from('subscriptions')
    .update({ flw_tx_ref: txRef, plan })
    .eq('business_id', business.id);

  // 42703 = the `plan` migration hasn't run yet - still start checkout
  // (core pricing/plan works exactly as before), just without recording
  // which plan was picked until the column exists.
  if (updateError?.code === '42703') {
    await supabaseAdmin.from('subscriptions').update({ flw_tx_ref: txRef }).eq('business_id', business.id);
  }

  return NextResponse.json({ checkoutUrl: flwData.data.link });
}
