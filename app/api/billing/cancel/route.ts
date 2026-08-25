import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/billing/cancel - stops future renewals. Access to the current
// paid period is intentionally left alone here (current_period_end stays
// as-is); the access gate should honor that rather than cutting them off
// mid-period they already paid for.
export async function POST(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id, flw_subscription_id')
    .eq('business_id', business.id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: 'No subscription found' }, { status: 404 });

  if (sub.flw_subscription_id && process.env.FLUTTERWAVE_SECRET_KEY) {
    const res = await fetch(
      `https://api.flutterwave.com/v3/subscriptions/${sub.flw_subscription_id}/cancel`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
      }
    ).catch((err) => {
      logError('api/billing/cancel:flutterwave', err, { businessId: business.id });
      return null;
    });
    if (res && !res.ok) {
      logError('api/billing/cancel:flutterwave', new Error(`Flutterwave responded ${res.status}`), {
        businessId: business.id,
      });
      // Still cancel locally below - don't let a Flutterwave-side hiccup
      // trap someone into a subscription they're actively trying to leave.
    }
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', sub.id);

  return NextResponse.json({ cancelled: true });
}
