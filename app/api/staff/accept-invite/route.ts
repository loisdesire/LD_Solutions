import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/staff/accept-invite - creates the invitee's auth account and
// staff row. Uses the service role because, like /api/signup, this needs
// to create an auth user, which the anon key can't do.
export async function POST(req: NextRequest) {
  if (!rateLimit(`accept-invite:${getClientIp(req)}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: 'Too many attempts, please try again later' }, { status: 429 });
  }

  const { token, password } = await req.json();

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('staff_invites')
    .select('id, business_id, email, role, accepted, businesses(name, slug)')
    .eq('token', token)
    .maybeSingle();

  if (inviteError || !invite || invite.accepted) {
    return NextResponse.json({ error: 'This invite is invalid or already used' }, { status: 400 });
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Could not create account' }, { status: 400 });
  }

  await supabaseAdmin.from('staff').insert({
    business_id: invite.business_id,
    auth_id: authUser.user.id,
    name: invite.email,
    email: invite.email,
    role: invite.role,
  });

  await supabaseAdmin.from('staff_invites').update({ accepted: true }).eq('id', invite.id);

  return NextResponse.json({
    email: invite.email,
    slug: (invite.businesses as any)?.slug,
  });
}
