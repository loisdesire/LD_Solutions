import { requireStaffSession } from '@/lib/requireStaffSession';
import { getSubscriptionState } from '@/lib/subscription';
import BillingManager from '@/components/BillingManager';
import PageHeader from '@/components/PageHeader';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Billing' };

// The one admin page reachable with an expired trial - everything else
// redirects here via requireStaffSession's gate, so this can't itself
// require an active subscription. That rules out the usual
// `requireOwner: true` redirect for the owner-only check below: if a
// non-owner staff member's trial were expired, requireOwner redirecting
// to /admin would just bounce straight back here via THAT page's own
// subscription check, looping forever. Handled inline instead - render
// a plain message for a non-owner rather than ever redirecting away.
export default async function BillingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase, staff } = await requireStaffSession(slug, { skipSubscriptionCheck: true });

  if (staff.role !== 'owner') {
    return (
      <div>
        <PageHeader eyebrow="Business" title="Billing" />
        <div className="rounded-2xl border border-line bg-warm-surface p-8 text-center">
          <p className="text-body-sm text-ink-soft">
            Billing is managed by {business.name}&rsquo;s owner. Ask them if you need something changed here.
          </p>
        </div>
      </div>
    );
  }

  let [{ data: sub, error: subError }, { data: history }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end, plan')
      .eq('business_id', business.id)
      .maybeSingle(),
    supabase
      .from('payment_history')
      .select('id, amount, status, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
  ]);

  // Before the plan migration runs, selecting a nonexistent column fails
  // the whole query - fall back to reading the plan-less row rather than
  // showing this business as having no subscription at all.
  if (subError?.code === '42703') {
    const fallback = await supabase
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end')
      .eq('business_id', business.id)
      .maybeSingle();
    if (fallback.data) sub = { ...fallback.data, plan: null };
  }

  const state = getSubscriptionState(sub ?? null);

  return (
    <div>
      <PageHeader eyebrow="Business" title="Billing" />
      <BillingManager slug={slug} state={state} history={history ?? []} />
    </div>
  );
}
