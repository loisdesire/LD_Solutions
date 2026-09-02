import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isAcceptablePassword, isUuid } from '@/lib/apiValidation';
import { notifyOwnerByEmail } from '@/lib/notifyOwnerOfChange';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/staff/accept-invite - creates the invitee's auth account and
// staff row. Uses the service role because, like /api/signup, this needs
// to create an auth user, which the anon key can't do.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`accept-invite:${getClientIp(req)}`, 10, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts, please try again later' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { token, password } = body;
  if (!isUuid(token) || !isAcceptablePassword(password)) {
    return NextResponse.json({ error: 'Invalid invite or password' }, { status: 400 });
  }

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

  const { error: staffError } = await supabaseAdmin.from('staff').insert({
    business_id: invite.business_id,
    auth_id: authUser.user.id,
    name: invite.email,
    email: invite.email,
    role: invite.role,
  });

  if (staffError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: 'Could not add this account to the team' }, { status: 500 });
  }

  const { error: acceptError } = await supabaseAdmin.from('staff_invites').update({ accepted: true }).eq('id', invite.id);
  if (acceptError) {
    await supabaseAdmin.from('staff').delete().eq('auth_id', authUser.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: 'Could not finish accepting this invite' }, { status: 500 });
  }

  // Sending the invite already emails the owner; accepting it never told
  // them the person actually joined - they'd only find out by checking
  // the Staff page themselves. Never blocks the response either way.
  try {
    await notifyOwnerByEmail(invite.business_id, {
      subject: `${invite.email} joined your team`,
      heading: 'A new team member joined',
      intro: `${invite.email} accepted their invite and can now sign in.`,
      rows: [
        { label: 'Email', value: invite.email },
        { label: 'Role', value: invite.role === 'owner' ? 'Owner' : 'Staff' },
      ],
      logContext: 'accept-invite:notify-owner',
    });
  } catch (err) {
    logError('accept-invite:notify-owner', err, { businessId: invite.business_id });
  }

  return NextResponse.json({
    email: invite.email,
    slug: (invite.businesses as any)?.slug,
  });
}
