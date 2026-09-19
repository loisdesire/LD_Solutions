import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSuperAdminSession } from '@/lib/requireSuperAdminSession';
import { createServerSupabase } from '@/lib/supabase-server';
import { logSuperAdminAction } from '@/lib/superAdminAudit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/super-admin/impersonate { slug } - mints a real session as
// the target business's owner, same underlying mechanism
// app/api/demo-login/route.ts already uses for the fixed demo-viewer
// account (generateLink + verifyOtp through the SSR client, so its
// cookie-writing is handled correctly), just for a real owner's real
// email instead of one fixed account.
//
// This REPLACES the current session with the owner's - same as
// demo-login, there's no "return to super-admin" afterward short of
// logging back in as the super-admin account again. Not building a
// session-swap-back mechanism for this first pass; the layout's "Back to
// site" link is a plain nav link, not a real restore.
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
    return NextResponse.json({ error: "This business has no owner staff row to log in as." }, { status: 404 });
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: owner.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Could not create a login link for this owner.' }, { status: 500 });
  }

  const supabase = await createServerSupabase();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    return NextResponse.json({ error: 'Could not start a session as this owner.' }, { status: 500 });
  }

  // Fire-and-forget, after the session swap already succeeded - see
  // logSuperAdminAction's own comment for why this never blocks the
  // actual impersonation.
  void logSuperAdminAction({
    actorEmail: user.email ?? 'unknown',
    action: 'impersonate',
    businessId: business.id,
    businessSlug: business.slug,
  });

  return NextResponse.json({ ok: true });
}
