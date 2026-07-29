import { getBusinessBySlug } from './getBusinessBySlug';
import { createServerSupabase } from './supabase-server';
import { getSubscriptionState } from './subscription';
import { notFound, redirect } from 'next/navigation';

// Shared by every /[slug]/admin/* page: confirms the visitor is logged in
// and is staff for THIS business, then hands back a session-aware Supabase
// client (so callers can do further RLS-respecting reads/writes) plus the
// business row. Also gates on subscription status — pass
// `skipSubscriptionCheck: true` only from the billing page itself, since
// that's the one page a business with an expired trial still needs to
// reach in order to pay and regain access.
export async function requireStaffSession(
  slug: string,
  options: { skipSubscriptionCheck?: boolean } = {}
) {
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

  if (!options.skipSubscriptionCheck) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end')
      .eq('business_id', business.id)
      .maybeSingle();

    if (!getSubscriptionState(sub).hasAccess) {
      redirect(`/${slug}/admin/billing`);
    }
  }

  return { business, supabase, staff: staffRow, user };
}
