import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isUuid } from '@/lib/apiValidation';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/staff/verify-email - marks a staff row's email as confirmed.
// Unauthenticated by design, same shape as api/staff/accept-invite:
// whoever holds the token proved they received the email at that
// address, that's the entire thing being checked. Not scoped by slug -
// the token is a UUID looked up on its own unique index, so it doesn't
// need one to be unambiguous.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`verify-email:${getClientIp(req)}`, 20, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts, please try again later' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { token } = body;
  if (!isUuid(token)) {
    return NextResponse.json({ error: 'This verification link is invalid' }, { status: 400 });
  }

  const { data: staff, error } = await supabaseAdmin
    .from('staff')
    .select('id, email, email_verified_at')
    .eq('email_verify_token', token)
    .maybeSingle();

  if (error || !staff) {
    return NextResponse.json({ error: 'This verification link is invalid' }, { status: 404 });
  }

  // Re-visiting an already-used link (a second click, an email client's
  // link-prefetch scanner hitting it before the person does) is a normal
  // thing to happen, not an error - report success either way rather than
  // making a stale-looking "invalid link" the first thing a real click sees.
  if (staff.email_verified_at) {
    return NextResponse.json({ ok: true, email: staff.email, alreadyVerified: true });
  }

  const { error: updateError } = await supabaseAdmin
    .from('staff')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('id', staff.id);

  if (updateError) {
    return NextResponse.json({ error: 'Could not verify this email right now, please try again' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: staff.email });
}
