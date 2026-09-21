import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSuperAdminSession } from '@/lib/requireSuperAdminSession';
import { logSuperAdminAction } from '@/lib/superAdminAudit';
import { DEMO_VIEWER_AUTH_ID } from '@/lib/demo';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/super-admin/force-sign-out { slug } - revokes every active
// session (all devices, all refresh tokens) for the business owner, via
// Supabase's own admin.signOut(userId, 'global'). Direct fix for the
// session-expiry bug found in regression testing: an owner's session
// silently expires mid-use, and their own correct password then reads as
// "invalid credentials" - forcing a clean global sign-out is the manual
// unstick this route exists for, until the underlying bug is root-caused.
export async function POST(req: NextRequest) {
  const { user } = await requireSuperAdminSession();

  const { slug } = await req.json().catch(() => ({ slug: null }));
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing business slug.' }, { status: 400 });
  }

  const { data: business } = await supabaseAdmin.from('businesses').select('id, slug').eq('slug', slug).maybeSingle();
  if (!business) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
  }

  // Excludes the demo-viewer account - glow-salon (see DEMO_SLUG in
  // lib/site.ts) is both a real business and the public homepage demo, so
  // it genuinely has two 'owner' staff rows. Without this, .maybeSingle()
  // errors on "more than one row returned" for exactly this one business
  // (confirmed live: PGRST116).
  const { data: owner } = await supabaseAdmin
    .from('staff')
    .select('auth_id')
    .eq('business_id', business.id)
    .eq('role', 'owner')
    .neq('auth_id', DEMO_VIEWER_AUTH_ID)
    .maybeSingle();

  if (!owner?.auth_id) {
    return NextResponse.json({ error: 'This business has no owner account to sign out.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.auth.admin.signOut(owner.auth_id, 'global');
  if (error) {
    return NextResponse.json({ error: "Couldn't sign this owner out." }, { status: 500 });
  }

  void logSuperAdminAction({
    actorEmail: user.email ?? 'unknown',
    action: 'force_sign_out',
    businessId: business.id,
    businessSlug: business.slug,
  });

  return NextResponse.json({ ok: true });
}
