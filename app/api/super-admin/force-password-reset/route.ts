import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSuperAdminSession } from '@/lib/requireSuperAdminSession';
import { logSuperAdminAction } from '@/lib/superAdminAudit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/super-admin/force-password-reset { slug } - sends the
// owner's own resetPasswordForEmail link, same one ForgotPasswordForm
// triggers, for support to use when an owner is locked out and can't
// reach their own /forgot-password (e.g. the session-expiry bug where a
// correct password is briefly rejected). Doesn't change the password
// itself - it emails a link the owner has to click, so a compromised
// super-admin account can't silently take over a business this way.
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

  const { data: owner } = await supabaseAdmin
    .from('staff')
    .select('email')
    .eq('business_id', business.id)
    .eq('role', 'owner')
    .maybeSingle();

  if (!owner?.email) {
    return NextResponse.json({ error: 'This business has no owner staff row to reset.' }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vanovahub.com';
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(owner.email, {
    redirectTo: `${siteUrl}/${business.slug}/reset-password`,
  });

  if (error) {
    return NextResponse.json({ error: "Couldn't send the reset link." }, { status: 500 });
  }

  void logSuperAdminAction({
    actorEmail: user.email ?? 'unknown',
    action: 'force_password_reset',
    businessId: business.id,
    businessSlug: business.slug,
  });

  return NextResponse.json({ ok: true });
}
