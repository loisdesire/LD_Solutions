import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase';
import { SITE_URL } from '@/lib/site';

// Paths that involve cookie-scoped auth (staff session or customer
// session) - these only work correctly on the platform's own domain, since
// that's the domain the auth cookie is actually set on. A business's
// custom domain serves its public booking pages only; staff still manage
// the business and log in via <slug>.<platform domain>, exactly as before.
const PLATFORM_ONLY_PREFIXES = ['/admin', '/login', '/accept-invite', '/forgot-password', '/reset-password', '/manage'];

const PLATFORM_HOSTNAME = (() => {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return 'vanovahub.com';
  }
})();

// Matches the platform's own hostname with or without a leading "www.",
// in both directions. Vercel serves whichever of the two you set primary
// and 308-redirects the other, so the host that actually arrives here may
// not be the one SITE_URL is written with - and a mismatch means every
// request to the marketing site falls through to the custom-domain
// lookup below and pays for a Supabase round trip it can never use.
function isPlatformHost(hostname: string): boolean {
  const bare = hostname.replace(/^www\./, '');
  const platformBare = PLATFORM_HOSTNAME.replace(/^www\./, '');
  return (
    bare === platformBare ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app')
  );
}

// Custom-domain routing: a request for glowsalon.com gets rewritten to
// /glow-salon under the hood, same app, same data - the business just
// never sees the /glow-salon prefix. Every non-platform host that reaches
// this deployment is looked up by businesses.custom_domain; anything that
// doesn't match (DNS pointed here but never actually connected in
// Settings, or the migration hasn't run yet - see the 42703 handling
// below) falls through to ordinary routing, which just renders the
// platform's own marketing site rather than erroring.
// Server Components (the admin layout, requireStaffSession) have no
// built-in way to read the current request's pathname - usePathname()
// only exists for Client Components. This header is the standard
// workaround: middleware runs on every request anyway, so it's a cheap
// place to hand the pathname down to anything server-side that needs it
// (see requireStaffSession's billing-page carve-out for why this exists).
function withPathnameHeader(req: NextRequest, res: NextResponse): NextResponse {
  res.headers.set('x-pathname', req.nextUrl.pathname);
  return res;
}

export async function middleware(req: NextRequest) {
  const hostname = req.nextUrl.hostname;
  if (isPlatformHost(hostname)) return withPathnameHeader(req, NextResponse.next());

  // Wrapped because this runs on EVERY request that reaches it: an
  // unguarded throw here (network blip, Supabase timeout) would 500 the
  // request rather than degrade. Falling through to normal routing is
  // always the safe outcome - worst case a custom domain temporarily
  // shows the platform site instead of the business's page.
  let business: { slug: string } | null = null;
  try {
    const { data, error } = await supabasePublic
      .from('businesses')
      .select('slug')
      .eq('custom_domain', hostname)
      .maybeSingle();
    // 42703 = the custom_domain column hasn't been migrated in yet on this
    // database - same defensive pattern as everywhere else this session.
    if (error) return NextResponse.next();
    business = data;
  } catch {
    return NextResponse.next();
  }

  if (!business) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  if (PLATFORM_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL(`/${business.slug}${pathname}${search}`, SITE_URL));
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${business.slug}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip API routes (they identify the business by id in the request body,
  // never by URL, so they need no rewriting) and Next's own static/image
  // assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
