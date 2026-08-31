import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PushSubscriptionJSON = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

function isValidSubscription(sub: unknown): sub is PushSubscriptionJSON {
  const s = sub as PushSubscriptionJSON | null;
  return Boolean(
    s &&
      typeof s.endpoint === 'string' &&
      s.endpoint.startsWith('https://') &&
      typeof s.keys?.p256dh === 'string' &&
      typeof s.keys?.auth === 'string'
  );
}

// POST /api/push/subscribe - a staff member (any role, not just owner - see
// requireStaffApiSession's third arg, deliberately omitted) enabling push
// notifications on this specific device/browser. Any staff member at the
// business gets notified of a new booking, not just the owner.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`push-subscribe:${getClientIp(req)}`, 20, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, subscription } = await req.json();
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }
  if (!isValidSubscription(subscription)) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id');
  if (auth.error) return auth.error;
  const { business, staff } = auth;

  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      business_id: business.id,
      staff_id: staff.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys!.p256dh,
      auth: subscription.keys!.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    // 42P01 = the push_subscriptions migration hasn't been run yet on this
    // database - fail clearly rather than a raw Postgres error reaching the
    // client, same convention as the rate-limit RPC fallback.
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Push notifications are not set up yet.' }, { status: 501 });
    }
    return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe - turning notifications off on this device.
// Scoped to the caller's own staff_id (via RLS-equivalent filter below, not
// just endpoint) so one staff member can't unsubscribe another's device by
// guessing/replaying an endpoint string.
export async function DELETE(req: NextRequest) {
  const { slug, endpoint } = await req.json();
  if (!slug || typeof slug !== 'string' || !endpoint || typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'Missing slug or endpoint' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id');
  if (auth.error) return auth.error;
  const { staff } = auth;

  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('staff_id', staff.id);

  return NextResponse.json({ ok: true });
}
