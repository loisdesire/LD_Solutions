import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/site';

// GET /account/callback — where the magic-link email points. Exchanges the
// one-time code for a real session (cookie-backed, same client the account
// dashboard reads via createServerSupabase), then sends them on to /account.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${SITE_URL}/account`);
}
