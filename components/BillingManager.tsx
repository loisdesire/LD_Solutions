'use client';

import { useEffect, useState } from 'react';
import { PLAN_PRICE_NGN, PLAN_LABEL } from '@/lib/subscription';
import type { SubscriptionState, Plan } from '@/lib/subscription';
import EmptyState from './EmptyState';
import ConfirmDialog from './ConfirmDialog';
import { useDialog } from './useDialog';
import { formatMoney } from '@/lib/formatMoney';

const LOCKED_NOTICE_COPY: Record<'trial' | 'payment', { title: string; message: string }> = {
  trial: {
    title: 'Your free trial has ended',
    message:
      "That's why you've landed here instead of where you were headed. Nothing's been touched - every booking, customer and setting is exactly how you left it. Pick a plan below and you'll be straight back in.",
  },
  payment: {
    title: "Your last payment didn't go through",
    message:
      "That's why you've landed here instead of where you were headed. Nothing's been touched - subscribe again below and you'll be straight back in.",
  },
};

const PLAN_BLURB: Record<Plan, string> = {
  core: 'Bookings, the AI receptionist, everything to run the calendar.',
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
  initiallyLocked = false,
}: {
  slug: string;
  state: SubscriptionState;
  history: PaymentRecord[];
  /** True when requireStaffSession redirected here because access ran out, as opposed to the owner just checking
   * their plan on their own - only the former should interrupt with the popup below. */
  initiallyLocked?: boolean;
}) {
  // Only actually show it if they're still locked out by the time this
  // renders - a stale ?locked=1 sitting in a bookmarked/shared URL
  // shouldn't pop this up for someone who has since subscribed.
  const [showLockedNotice, setShowLockedNotice] = useState(initiallyLocked && !state.hasAccess);
  const lockedDialogRef = useDialog(showLockedNotice, () => setShowLockedNotice(false));

  // Clears ?locked=1 from the address bar once shown, same reasoning as
  // AssistantChat's ?q= cleanup - otherwise refreshing this exact URL
  // (or someone sharing it) re-triggers the popup every time.
  useEffect(() => {
    if (!initiallyLocked) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('locked');
    window.history.replaceState(null, '', url.pathname + url.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
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
    setConfirmingCancel(false);
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
            {formatMoney(PLAN_PRICE_NGN[state.plan])}
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
                onClick={() => setConfirmingCancel(true)}
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
              {/* Was a fixed grid-cols-2, so on a narrow phone each card
                  was ~150px wide with a 3-4 line description wrapping
                  inside it - two squeezed columns rather than two real
                  choices. Single column below sm, side by side from
                  there up where there's actually room for it. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                {(Object.keys(PLAN_PRICE_NGN) as Plan[]).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`text-left rounded-xl border-2 px-4 py-3.5 transition-colors ${
                      selectedPlan === plan ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3 sm:block">
                      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
                        {PLAN_LABEL[plan]}
                      </div>
                      <div className="font-display text-[17px] text-ink sm:mt-0.5">
                        {formatMoney(PLAN_PRICE_NGN[plan])}
                      </div>
                    </div>
                    <p className="text-[12.5px] text-ink-soft mt-1 leading-snug">{PLAN_BLURB[plan]}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
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
        <div className="mt-8">
          <EmptyState
            compact
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M2 10h20" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            }
            title="No payments yet"
            description="Once your first monthly charge goes through, it'll be listed here."
          />
        </div>
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
                  {formatMoney(h.amount != null ? Number(h.amount) : null)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel your subscription?"
        message="You'll keep access until the end of your current billing period, then the rest of the dashboard pauses until you subscribe again."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        pending={loading}
        onConfirm={handleCancel}
        onCancel={() => setConfirmingCancel(false)}
      />

      {/* What used to happen instead: requireStaffSession silently
          redirected here with no explanation, so someone would just find
          themselves on Billing mid-task with no idea why. Same visual
          language as ConfirmDialog (built on the same useDialog primitive
          - focus trap, Escape, scroll lock), but a single reassuring
          "got it" rather than a decision to make. */}
      {showLockedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowLockedNotice(false)}>
          <div
            className="absolute inset-0 backdrop-blur-sm animate-fade"
            style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
          />
          <div
            ref={lockedDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="locked-notice-title"
            aria-describedby="locked-notice-message"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl bg-surface border-2 border-line shadow-card p-6 text-center animate-rise"
          >
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center mx-auto mb-3.5"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h2 id="locked-notice-title" className="font-display text-[18px] font-semibold text-ink mb-1.5">
              {LOCKED_NOTICE_COPY[state.phase === 'past_due' ? 'payment' : 'trial'].title}
            </h2>
            <p id="locked-notice-message" className="text-body-sm text-ink-soft leading-relaxed">
              {LOCKED_NOTICE_COPY[state.phase === 'past_due' ? 'payment' : 'trial'].message}
            </p>
            <button
              type="button"
              onClick={() => setShowLockedNotice(false)}
              className="w-full rounded-xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-contrast transition-opacity hover:opacity-90 active:scale-95 mt-5"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
