import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import { DEMO_VIEWER_EMAIL } from '@/lib/demo';
import { SITE_URL, DEMO_SLUG, DEMO_SLUGS } from '@/lib/site';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/demo-login?slug=<one of DEMO_SLUGS> - the "Pick a business to
// demo" page (/demo) points here, one link per real seeded demo business.
// Mints a real session for the fixed demo-viewer account (lib/demo.ts)
// server-side, with no password or magic-link click needed from the
// visitor, then sends them straight into that business's real admin - the
// same demo-viewer account now has its own write-blocked staff row on
// every business in DEMO_SLUGS (see lib/site.ts), not just Glow Salon.
// ?slug is validated against that fixed list, never trusted as-is - this
// mints a real session, so an arbitrary slug here would be a way to log
// the demo-viewer identity into any business's admin, not just the
// intended demo set.
//
// Same underlying mechanism /account/callback already uses for customer
// magic links (a Supabase-issued one-time token, exchanged for a session
// through the SSR client so its cookie-writing is handled correctly rather
// than hand-built here) - generateLink + verifyOtp instead of
// exchangeCodeForSession(code) only because this side originates the link
// itself (via the admin API) rather than receiving one a visitor clicked
// in an email.
// The only unauthenticated route in the API that calls Supabase's admin
// API (generateLink) on every hit, with no rate limit until now - every
// other public route that does real work (bookings, staff invites,
// reschedule...) already has one. Low severity (this mints a session for
// a single fixed, write-blocked demo account - see lib/demo.ts and
// schema.sql's "block writes at the database itself" section - so
// there's no data at risk), but an unlimited hammer on this still burns
// Supabase's own admin-API quota for the whole project, which could
// degrade real magic-link logins elsewhere. Same limit shape as the
// booking routes.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`demo-login:${getClientIp(req)}`, 10, 5 * 60_000))) {
    return NextResponse.redirect(`${SITE_URL}/`);
  }

  const requestedSlug = req.nextUrl.searchParams.get('slug');
  const slug = requestedSlug && DEMO_SLUGS.includes(requestedSlug) ? requestedSlug : DEMO_SLUG;

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

  return NextResponse.redirect(`${SITE_URL}/${slug}/admin`);
}
