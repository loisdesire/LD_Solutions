import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

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
  if (!rateLimit(`check-slug:${getClientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug')?.trim().toLowerCase();
  if (!slug || slug.length < 2) {
    return NextResponse.json({ available: false });
  }

  const { data: existing } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();

  return NextResponse.json({ available: !existing });
}
