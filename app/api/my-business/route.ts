import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// GET /api/my-business — used right after a platform-level login (see
// PlatformLoginForm) to find which business the signed-in account belongs
// to. Deliberately server-side: doing this same lookup immediately
// client-side, right after signInWithPassword resolves, was unreliable —
// the RLS-scoped query would sometimes run before the browser client's
// session was fully attached, coming back empty even though the account
// genuinely has a staff row. Reading the session from cookies server-side
// (the same mechanism requireStaffSession already uses successfully on
// every admin page) sidesteps that race entirely.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('business_id, businesses(slug)')
    .limit(1)
    .maybeSingle();

  // Supabase's join typing claims this is always array-shaped even for a
  // to-one relation, but at runtime it can come back as a plain object
  // instead (confirmed via logging: {"slug":"glow-salon"}, not
  // [{"slug":"glow-salon"}]) — treating it as an array unconditionally
  // silently found nothing and returned 404 even when the data was right
  // there. Handling both shapes rather than trusting the type.
  const businesses = staffRow?.businesses as { slug: string } | { slug: string }[] | null;
  const slug = Array.isArray(businesses) ? businesses[0]?.slug : businesses?.slug;

  if (!slug) {
    return NextResponse.json({ error: "We couldn't find a business linked to this account." }, { status: 404 });
  }

  return NextResponse.json({ slug });
}
