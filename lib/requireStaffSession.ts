import { getBusinessBySlug } from './getBusinessBySlug';
import { createServerSupabase } from './supabase-server';
import { notFound, redirect } from 'next/navigation';

// Shared by every /[slug]/admin/* page: confirms the visitor is logged in
// and is staff for THIS business, then hands back a session-aware Supabase
// client (so callers can do further RLS-respecting reads/writes) plus the
// business row.
export async function requireStaffSession(slug: string) {
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();
  const { business } = data;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${slug}/login`);

  const { data: staffRow } = await supabase
    .from('staff')
    .select('id, role')
    .eq('business_id', business.id)
    .eq('auth_id', user.id)
    .maybeSingle();

  if (!staffRow) redirect(`/${slug}/login`);

  return { business, supabase, staff: staffRow, user };
}
