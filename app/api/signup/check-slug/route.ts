import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { cleanSlug } from '@/lib/apiValidation';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/signup/check-slug?slug=... - a live "is this taken" check while
// someone is still typing their business name, not something they only
// find out after filling in email and password and pressing submit. The
// actual signup route (api/signup) still re-checks server-side before
// creating anything - this is purely a faster no for the common case,
// not the source of truth.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`check-slug:${getClientIp(req)}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const slug = cleanSlug(req.nextUrl.searchParams.get('slug'));
  if (!slug) {
    return NextResponse.json({ available: false });
  }

  const { data: existing, error } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
  if (error) {
    logError('check-slug', error, { slug });
    // Fail closed: a customer typing a slug can't tell "taken" from
    // "couldn't check", so an errored check has to read as "not
    // available" rather than flash a false green checkmark. The real
    // signup route still re-validates before creating anything either
    // way, but no reason to lie to the user in the meantime.
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({ available: !existing });
}
