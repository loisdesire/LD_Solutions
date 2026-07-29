import { requireStaffSession } from '@/lib/requireStaffSession';
import { getSubscriptionState } from '@/lib/subscription';
import BillingManager from '@/components/BillingManager';

// The one admin page reachable with an expired trial — everything else
// redirects here via requireStaffSession's gate, so this can't itself
// require an active subscription.
export default async function BillingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug, { skipSubscriptionCheck: true });

  const [{ data: sub }, { data: history }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end')
      .eq('business_id', business.id)
      .maybeSingle(),
    supabase
      .from('payment_history')
      .select('id, amount, status, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
  ]);

  const state = getSubscriptionState(sub ?? null);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage
        </div>
        <h1 className="font-display text-[26px] text-ink">Billing</h1>
      </div>

      <BillingManager slug={slug} state={state} history={history ?? []} />
    </div>
  );
}
