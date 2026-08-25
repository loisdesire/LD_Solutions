import { getBusinessBySlug } from './getBusinessBySlug';
import { createServerSupabase } from './supabase-server';
import { getSubscriptionState } from './subscription';
import { notFound, redirect } from 'next/navigation';
import { DEMO_VIEWER_AUTH_ID } from './demo';

// Shared by every /[slug]/admin/* page: confirms the visitor is logged in
// and is staff for THIS business, then hands back a session-aware Supabase
// client (so callers can do further RLS-respecting reads/writes) plus the
// business row. Also gates on subscription status - pass
// `skipSubscriptionCheck: true` only from the billing page itself, since
// that's the one page a business with an expired trial still needs to
// reach in order to pay and regain access.
//
// `requireOwner: true` redirects a non-owner staff member back to the
// dashboard - this is defense-in-depth, not the real boundary: the
// database's own RLS policies (see the "Owner-only enforcement" section
// of supabase/schema.sql) are what actually stop a non-owner from
// writing owner-only data even if they bypass this page entirely and
// call Supabase directly. This just keeps a staff member from landing on
// a page that would only fail once they tried to use it.
export async function requireStaffSession(
  slug: string,
  options: { skipSubscriptionCheck?: boolean; requireOwner?: boolean } = {}
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

  if (options.requireOwner && staffRow.role !== 'owner') {
    redirect(`/${slug}/admin`);
  }

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

  // Surfaced so pages can show a "this is a live demo" banner - the actual
  // write-blocking happens elsewhere (requireStaffApiSession, and the DB
  // trigger for direct-from-browser writes), this is purely so the visitor
  // finds out before they try, not just after.
  const isDemoReadOnly = user.id === DEMO_VIEWER_AUTH_ID;

  return { business, supabase, staff: staffRow, user, isDemoReadOnly };
}
