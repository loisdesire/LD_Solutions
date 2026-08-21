import { requireStaffSession } from '@/lib/requireStaffSession';
import { getSubscriptionState } from '@/lib/subscription';
import BillingManager from '@/components/BillingManager';

// The one admin page reachable with an expired trial - everything else
// redirects here via requireStaffSession's gate, so this can't itself
// require an active subscription.
export default async function BillingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug, { skipSubscriptionCheck: true });

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
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage
        </div>
        <h1 className="font-display text-h1 text-ink">Billing</h1>
      </div>

      <BillingManager slug={slug} state={state} history={history ?? []} />
    </div>
  );
}
