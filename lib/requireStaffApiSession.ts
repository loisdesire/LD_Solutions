import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// API-route equivalent of requireStaffSession (lib/requireStaffSession.ts).
// That one calls next/navigation's redirect()/notFound(), which only makes
// sense for page rendering, not a fetch()-consumed API route - hence a
// separate implementation rather than a wrapper around it. `columns` lets a
// caller pull back extra business fields it actually needs (e.g.
// 'id, whatsapp_number, telegram_bot_token') in this same query instead of
// a second round trip right after this one.
//
// `requireOwner: true` 403s a non-owner staff member - defense-in-depth
// alongside the database's own RLS policies (supabase/schema.sql's
// "Owner-only enforcement" section), which are the real boundary for
// anything written straight to Supabase. This is what actually stops a
// non-owner from reaching routes that write through the service role
// (billing, settings) instead, since those bypass RLS entirely by design.
export async function requireStaffApiSession(
  slug: string,
  columns = 'id',
  options: { requireOwner?: boolean } = {}
) {
  const supabase = await createServerSupabase();
  const [{ data: business }, userResult] = await Promise.all([
    supabaseAdmin.from('businesses').select(columns).eq('slug', slug).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const user = userResult.data.user;

  if (!business) return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) };
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };

  const { data: staffRow } = await supabase
    .from('staff')
    .select('id, role')
    .eq('business_id', (business as any).id)
    .eq('auth_id', user.id)
    .maybeSingle();
  if (!staffRow) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };

  if (options.requireOwner && staffRow.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Only the business owner can do this' }, { status: 403 }) };
  }

  return { business: business as any, staff: staffRow };
}
