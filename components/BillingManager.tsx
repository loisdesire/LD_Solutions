'use client';

import { useState } from 'react';
import { PLAN_PRICE_NGN, PLAN_LABEL } from '@/lib/subscription';
import type { SubscriptionState, Plan } from '@/lib/subscription';

const PLAN_BLURB: Record<Plan, string> = {
  core: 'Bookings, the AI receptionist, everything you need to run the calendar.',
  business_intelligence: 'Everything in Core, plus an AI insights panel for you and richer AI answers for customers.',
};

type PaymentRecord = {
  id: string;
  amount: number | null;
  status: string;
  created_at: string;
};

const STATUS_COPY: Record<SubscriptionState['phase'], { label: string; pill: string }> = {
  active: { label: 'Active', pill: 'bg-success-bg text-success' },
  trial: { label: 'Free trial', pill: 'bg-accent-soft text-accent' },
  cancelling: { label: 'Cancelling', pill: 'bg-warning-bg text-warning' },
  past_due: { label: 'Payment failed', pill: 'bg-error-bg text-error' },
  expired: { label: 'Trial ended', pill: 'bg-error-bg text-error' },
  none: { label: 'No active plan', pill: 'bg-error-bg text-error' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BillingManager({
  slug,
  state,
  history,
}: {
  slug: string;
  state: SubscriptionState;
  history: PaymentRecord[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  // Defaults to whatever plan they're already on (or were on before it
  // lapsed) rather than always resetting to Core - someone re-subscribing
  // after a failed payment shouldn't get quietly downgraded.
  const [selectedPlan, setSelectedPlan] = useState<Plan>(state.plan);

  async function handleSubscribe() {
    setLoading(true);
    setError('');

    // Without this, a dropped connection throws out of the handler, the
    // rejection goes unhandled, and `loading` is never cleared - leaving
    // the button disabled on "Redirecting..." with no way back except a
    // page reload.
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, plan: selectedPlan }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel your subscription? You\'ll keep access until the end of your current billing period.')) {
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setCancelled(true);
    } catch {
      setLoading(false);
      setError("Couldn't reach the server. Your subscription has not been changed.");
    }
  }

  const copy = STATUS_COPY[state.phase];

  return (
    <div className="max-w-lg">
      <div className="border-2 border-line rounded-2xl overflow-hidden bg-surface">
        <div className="p-6 border-b border-dashed border-line">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${copy.pill}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {cancelled ? 'Cancelling' : copy.label}
            {state.phase === 'trial' && `, ${state.trialDaysLeft} day${state.trialDaysLeft === 1 ? '' : 's'} left`}
          </span>

          <h2 className="font-display text-[22px] mt-3">
            ₦{PLAN_PRICE_NGN[state.plan].toLocaleString()}
            <span className="text-[14px] font-normal text-ink-faint"> / month</span>
          </h2>
          <p className="text-ink-soft text-[13.5px] mt-1.5">
            {PLAN_LABEL[state.plan]} plan. {PLAN_BLURB[state.plan]}
          </p>

          {state.phase === 'active' && (
            <p className="text-ink-faint text-[12.5px] mt-3">
              Next payment: <span className="text-ink font-medium">{formatDate(state.currentPeriodEnd)}</span>
            </p>
          )}
          {(state.phase === 'cancelling' || cancelled) && (
            <p className="text-ink-faint text-[12.5px] mt-3">
              Access ends: <span className="text-ink font-medium">{formatDate(state.currentPeriodEnd)}</span>. No further charges.
            </p>
          )}
          {state.phase === 'trial' && (
            <p className="text-ink-faint text-[12.5px] mt-3">
              Trial ends and first charge would be: <span className="text-ink font-medium">
                {formatDate(new Date(Date.now() + (state.trialDaysLeft ?? 0) * 86400000).toISOString())}
              </span>
            </p>
          )}
          {state.phase === 'past_due' && (
            <p className="text-error text-[12.5px] mt-3">
              Your last payment didn't go through. Subscribe again below to restore access.
            </p>
          )}
        </div>

        <div className="p-6">
          {state.phase === 'active' && !cancelled ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13.5px] text-ink-soft">You're all set.</p>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="text-[13px] font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
              >
                Cancel subscription
              </button>
            </div>
          ) : state.phase === 'cancelling' || cancelled ? (
            <p className="text-[13.5px] text-ink-soft">
              You won't be charged again. You can keep using everything until the date above.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {(Object.keys(PLAN_PRICE_NGN) as Plan[]).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`text-left rounded-xl border-2 px-3.5 py-3 transition-colors ${
                      selectedPlan === plan ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
                      {PLAN_LABEL[plan]}
                    </div>
                    <div className="font-display text-[17px] text-ink mt-0.5">
                      ₦{PLAN_PRICE_NGN[plan].toLocaleString()}
                    </div>
                    <p className="text-[11.5px] text-ink-soft mt-1 leading-snug">{PLAN_BLURB[plan]}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Redirecting…' : `Subscribe to ${PLAN_LABEL[selectedPlan]} with Flutterwave`}
              </button>
            </>
          )}
          {error && <p className="text-sm text-error mt-3">{error}</p>}
        </div>
      </div>

      {/* No mid-cycle plan-swap/proration yet - switching plans reuses the
          same tested cancel-then-resubscribe path rather than new billing
          logic, so it's a manual two-step for now. */}
      {(state.phase === 'active' || state.phase === 'cancelling') && !cancelled && (
        <p className="text-ink-faint text-[12.5px] mt-4">
          Want to switch to {PLAN_LABEL[state.plan === 'core' ? 'business_intelligence' : 'core']}? Cancel your
          current plan above, then subscribe again and pick the new one once this period ends.
        </p>
      )}

      {!state.hasAccess && state.phase !== 'past_due' && (
        <p className="text-ink-faint text-[12.5px] mt-4">
          Your trial has ended, so the rest of the dashboard is paused until you subscribe -
          nothing has been deleted, it'll all be right there once you're active again.
        </p>
      )}

      {history.length === 0 && (
        <p className="text-ink-faint text-caption mt-8">
          No payments yet. Once your first monthly charge goes through, it&apos;ll be listed here.
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-3">
            Payment history
          </h3>
          <div className="border-2 border-line rounded-2xl overflow-hidden bg-surface">
            {history.map((h, i) => (
              <div
                key={h.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i !== history.length - 1 ? 'border-b border-line' : ''
                }`}
              >
                <div>
                  <div className="text-[13.5px] font-medium text-ink">{formatDate(h.created_at)}</div>
                  <div
                    className={`font-mono text-[10px] uppercase tracking-[0.06em] mt-0.5 ${
                      h.status === 'successful' ? 'text-success' : 'text-error'
                    }`}
                  >
                    {h.status === 'successful' ? 'Paid' : 'Failed'}
                  </div>
                </div>
                <div className="font-mono text-[13.5px] font-semibold text-ink">
                  {h.amount != null ? `₦${Number(h.amount).toLocaleString()}` : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
