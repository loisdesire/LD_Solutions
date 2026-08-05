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
    error: userError,
  } = await supabase.auth.getUser();

  // TEMP diagnostic logging — remove once the login issue is confirmed fixed.
  console.log('[my-business] user:', user?.id, user?.email, 'userError:', userError?.message);

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('business_id, businesses(slug)')
    .limit(1)
    .maybeSingle();

  console.log('[my-business] staffRow:', JSON.stringify(staffRow), 'staffError:', staffError?.message);

  const slug = (staffRow?.businesses as { slug: string }[] | null)?.[0]?.slug;

  if (!slug) {
    return NextResponse.json({ error: "We couldn't find a business linked to this account." }, { status: 404 });
  }

  return NextResponse.json({ slug });
}
