import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { MONTHLY_PRICE_NGN } from '@/lib/subscription';
import { SITE_URL } from '@/lib/site';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/billing/checkout — starts a Flutterwave subscription checkout
// for this business. Requires a Payment Plan already created in the
// Flutterwave dashboard (Recurring Payments → Payment Plans) — that's a
// one-time manual step, its id goes in FLUTTERWAVE_PLAN_ID. We don't
// create plans dynamically here, since re-running that on every deploy
// risks duplicate plans.
export async function POST(req: NextRequest) {
  if (!process.env.FLUTTERWAVE_SECRET_KEY || !process.env.FLUTTERWAVE_PLAN_ID) {
    return NextResponse.json(
      { error: 'Payments are not configured yet — missing Flutterwave keys.' },
      { status: 503 }
    );
  }

  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(slug, 'id, name');
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
      amount: String(MONTHLY_PRICE_NGN),
      currency: 'NGN',
      redirect_url: `${SITE_URL}/${slug}/admin/billing`,
      payment_plan: process.env.FLUTTERWAVE_PLAN_ID,
      customer: {
        email: staffRow?.email ?? undefined,
        name: business.name,
      },
      customizations: {
        title: `${business.name} — subscription`,
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
  // when it lands.
  await supabaseAdmin
    .from('subscriptions')
    .update({ flw_tx_ref: txRef })
    .eq('business_id', business.id);

  return NextResponse.json({ checkoutUrl: flwData.data.link });
}
