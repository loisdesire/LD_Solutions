'use client';

import { useEffect, useState } from 'react';
import { PLAN_PRICE_NGN, PLAN_LABEL } from '@/lib/subscription';
import type { SubscriptionState, Plan } from '@/lib/subscription';
import EmptyState from './EmptyState';
import ConfirmDialog from './ConfirmDialog';
import { useDialog } from './useDialog';
import { formatMoney } from '@/lib/formatMoney';
import Icon from './Icon';

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

// Single public plan now - the AI insights panel used to be gated to
// business_intelligence specifically, but that wasn't a strong enough
// upsell to justify a second tier's decision friction (a solo operator
// doesn't have a ₦10,000/month problem "ask your data questions" solves),
// so it's bundled into every active subscription instead. Both entries
// kept, not just 'core' - state.plan is still typed as the full Plan
// union, and anyone who genuinely subscribed to business_intelligence
// before this change keeps a real, honest blurb rather than the type
// silently going stale.
const PLAN_BLURB: Record<Plan, string> = {
  core: 'Bookings, the AI receptionist, AI insights - everything to run the calendar.',
  business_intelligence: 'Same plan as Core now - this was an earlier, separately-priced tier.',
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

  async function handleSubscribe() {
    setLoading(true);
    setError('');

    // Without this, a dropped connection throws out of the handler, the
    // rejection goes unhandled, and `loading` is never cleared - leaving
    // the button disabled on "Redirecting..." with no way back except a
    // page reload.
    try {
      // Always 'core' now - the only plan being sold. Someone who was
      // already on business_intelligence and re-subscribes lands on core
      // going forward, which is correct: it's the same product at this
      // point, just the current price.
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, plan: 'core' }),
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
      <div className="border border-line shadow-soft rounded-xl overflow-hidden bg-surface">
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
              {/* One plan now - no picker needed. See PLAN_BLURB's own
                  comment for why the second tier was dropped. */}
              <div className="rounded-xl border border-line bg-warm-surface px-4 py-3.5 mb-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
                    {PLAN_LABEL.core}
                  </div>
                  <div className="font-display text-[17px] text-ink">{formatMoney(PLAN_PRICE_NGN.core)}</div>
                </div>
                <p className="text-[12.5px] text-ink-soft mt-1 leading-snug">{PLAN_BLURB.core}</p>
              </div>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Redirecting…' : `Subscribe with Flutterwave`}
              </button>
            </>
          )}
          {error && <p className="text-sm text-error mt-3">{error}</p>}
        </div>
      </div>

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
            icon={<Icon name="credit_card" size={19} />}
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
          <div className="border border-line shadow-soft rounded-xl overflow-hidden bg-surface">
            {history.map((h, i) => {
              const paid = h.status === 'successful';
              return (
                <div
                  key={h.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i !== history.length - 1 ? 'border-b border-line' : ''
                  }`}
                >
                  <div className="text-[13.5px] font-medium text-ink flex-1">{formatDate(h.created_at)}</div>
                  <div className="font-mono text-[13.5px] font-semibold text-ink tabular-nums">
                    {formatMoney(h.amount != null ? Number(h.amount) : null)}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0 ${
                      paid
                        ? 'bg-success-bg text-success border-success-border'
                        : 'bg-error-bg text-error border-error-border'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {paid ? 'Paid' : 'Failed'}
                  </span>
                </div>
              );
            })}
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
              <Icon name="lock" size={21} />
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
