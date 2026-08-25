import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import { DEMO_VIEWER_EMAIL } from '@/lib/demo';
import { SITE_URL, DEMO_SLUG } from '@/lib/site';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/demo-login - "See the dashboard" on the marketing homepage
// points here. Mints a real session for the fixed demo-viewer account
// (lib/demo.ts) server-side, with no password or magic-link click needed
// from the visitor, then sends them straight into the real admin.
//
// Same underlying mechanism /account/callback already uses for customer
// magic links (a Supabase-issued one-time token, exchanged for a session
// through the SSR client so its cookie-writing is handled correctly rather
// than hand-built here) - generateLink + verifyOtp instead of
// exchangeCodeForSession(code) only because this side originates the link
// itself (via the admin API) rather than receiving one a visitor clicked
// in an email.
export async function GET() {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: DEMO_VIEWER_EMAIL,
  });

  if (error || !data?.properties?.hashed_token) {
    return NextResponse.redirect(`${SITE_URL}/`);
  }

  const supabase = await createServerSupabase();
  // token_hash and type only - the API rejects the call outright
  // ("Only the token_hash and type should be provided") if email is also
  // passed alongside a token_hash, unlike the plain-OTP-code verify flow.
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  });

  if (verifyError) {
    return NextResponse.redirect(`${SITE_URL}/`);
  }

  return NextResponse.redirect(`${SITE_URL}/${DEMO_SLUG}/admin`);
}
