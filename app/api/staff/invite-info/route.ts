import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/staff/invite-info?token=... — the invitee isn't logged in yet,
// so this looks the invite up with the service role and returns only the
// minimum needed to render the accept-invite form (not the whole row).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const { data: invite } = await supabaseAdmin
    .from('staff_invites')
    .select('email, accepted, businesses(name, slug)')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.accepted) {
    return NextResponse.json({ error: 'This invite is invalid or already used' }, { status: 404 });
  }

  return NextResponse.json({
    email: invite.email,
    businessName: (invite.businesses as any)?.name,
  });
}
