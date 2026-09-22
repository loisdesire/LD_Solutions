import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { PLAN_PRICE_NGN, PLAN_LABEL, getBillingTier, BILLING_TIER_PRICE, type Plan, type BillingTier } from '@/lib/subscription';
import { SITE_URL } from '@/lib/site';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { DEMO_VIEWER_AUTH_ID } from '@/lib/demo';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Each plan/tier needs its own Payment Plan created by hand in the
// Flutterwave dashboard (Recurring Payments → Payment Plans) - a manual,
// one-time step, not created dynamically here (re-running that on every
// deploy risks duplicates). business_intelligence isn't actually sold
// (see PLAN_PRICE_NGN's own comment) so it isn't tiered - kept on its
// legacy single NGN plan, unchanged.
const PLAN_ENV_KEY: Record<Plan, string> = {
  core: 'FLUTTERWAVE_PLAN_ID',
  business_intelligence: 'FLUTTERWAVE_PLAN_ID_BI',
};

// Geographic pricing tiers for 'core' - see lib/subscription.ts's
// BILLING_TIER_PRICE for the actual amounts/currencies.
const TIER_ENV_KEY: Record<BillingTier, string> = {
  NG: 'FLUTTERWAVE_PLAN_ID',
  GH: 'FLUTTERWAVE_PLAN_ID_GH',
  AFRICA: 'FLUTTERWAVE_PLAN_ID_AFRICA',
  INTL: 'FLUTTERWAVE_PLAN_ID_USD',
};

// POST /api/billing/checkout - starts a Flutterwave subscription checkout
// for this business, for whichever plan they picked.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`billing-checkout:${getClientIp(req)}`, 10, 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, plan: rawPlan } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const plan: Plan = rawPlan === 'business_intelligence' ? 'business_intelligence' : 'core';

  const auth = await requireStaffApiSession(req, slug, 'id, name, home_country_code', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  // Only 'core' (the only plan actually sold, see PLAN_PRICE_NGN's own
  // comment) gets geographic pricing - a business's home_country_code
  // (geolocated once at signup, never touched by payout-linking - see
  // supabase/schema.sql) decides which of four tiers it bills at,
  // automatically, never as a choice offered to them (the owner's own
  // call: anyone could otherwise just pick the cheapest tier regardless
  // of where they actually are).
  const tier: BillingTier | null = plan === 'core' ? getBillingTier(business.home_country_code) : null;
  const { amount, currency } = tier ? BILLING_TIER_PRICE[tier] : { amount: PLAN_PRICE_NGN[plan], currency: 'NGN' };
  const flwPlanId = process.env[tier ? TIER_ENV_KEY[tier] : PLAN_ENV_KEY[plan]];

  if (!process.env.FLUTTERWAVE_SECRET_KEY || !flwPlanId) {
    return NextResponse.json(
      { error: `The ${PLAN_LABEL[plan]} plan isn't fully set up yet - missing its Flutterwave plan ID.` },
      { status: 503 }
    );
  }

  // Excludes the demo-viewer account explicitly - glow-salon (see
  // DEMO_SLUG in lib/site.ts) is both a real business and the public
  // homepage demo, so it genuinely has two 'owner' staff rows. Without
  // this, .maybeSingle() errors on "more than one row returned" for
  // exactly this one business, which is what silently killed checkout
  // here - confirmed live, not a Flutterwave-side problem.
  const { data: staffRow } = await supabaseAdmin
    .from('staff')
    .select('email')
    .eq('business_id', business.id)
    .eq('role', 'owner')
    .neq('auth_id', DEMO_VIEWER_AUTH_ID)
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
      amount: String(amount),
      currency,
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
