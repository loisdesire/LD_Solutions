// Client-safe only — no Supabase client, no service-role key. BillingManager
// (a client component) imports MONTHLY_PRICE_NGN from here; anything with a
// module-scope `createClient(..., SUPABASE_SERVICE_ROLE_KEY)` call belongs in
// subscription-server.ts instead; SUPABASE_SERVICE_ROLE_KEY isn't
// NEXT_PUBLIC_-prefixed, so it's undefined in a client bundle and crashes
// the whole module at evaluation time — "supabaseKey is required" — the
// instant anything client-side imports even one unrelated export from a
// file that also does that at the top level.

export type Plan = 'core' | 'business_intelligence';

// Referenced by both the billing page (what it shows) and the checkout
// route (what it actually charges), so there's exactly one number to change
// per plan. Both AI receptionist booking capability and the dashboard are
// in 'core' — the thing 'business_intelligence' actually adds is deeper AI
// access: the owner-facing insights panel, and richer business-info
// answers in the public chat (top services, etc). It is NOT "AI vs no AI" —
// every plan gets the same booking AI, since that's the entire premise of
// the product, not an upsell.
export const PLAN_PRICE_NGN: Record<Plan, number> = {
  core: 15000,
  business_intelligence: 20000,
};

export const PLAN_LABEL: Record<Plan, string> = {
  core: 'Core',
  business_intelligence: 'Business Intelligence',
};

// Kept for existing call sites that only ever meant "the price" before
// plans existed — equivalent to PLAN_PRICE_NGN.core.
export const MONTHLY_PRICE_NGN = PLAN_PRICE_NGN.core;

export type Subscription = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan?: string | null;
};

export type SubscriptionState = {
  // Whether the business should actually be let into the admin area right
  // now — the one thing every call site actually cares about.
  hasAccess: boolean;
  // 'trial' | 'active' | 'cancelling' | 'past_due' | 'expired' | 'none' —
  // 'none' covers a business created before subscriptions existed, or some
  // other edge case with no row at all; treated as expired (no free pass)
  // rather than silently granting access.
  phase: 'trial' | 'active' | 'cancelling' | 'past_due' | 'expired' | 'none';
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  plan: Plan;
};

function normalizePlan(plan: string | null | undefined): Plan {
  return plan === 'business_intelligence' ? 'business_intelligence' : 'core';
}

// Centralizes "is this business allowed in" so it's computed the same way
// everywhere (the access gate, and the billing page showing status) — a
// naive `status === 'active'` check alone would incorrectly lock out
// someone still inside their trial window, or cut off someone who
// cancelled but already paid through the end of their current period.
export function getSubscriptionState(sub: Subscription | null): SubscriptionState {
  if (!sub) return { hasAccess: false, phase: 'none', trialDaysLeft: null, currentPeriodEnd: null, plan: 'core' };

  const plan = normalizePlan(sub.plan);
  const now = Date.now();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const stillWithinPaidPeriod = periodEnd !== null && periodEnd > now;

  if (sub.status === 'active') {
    return { hasAccess: true, phase: 'active', trialDaysLeft: null, currentPeriodEnd: sub.current_period_end, plan };
  }

  if (sub.status === 'cancelled') {
    // Cancelling stops future renewals, but doesn't claw back time they
    // already paid for.
    return {
      hasAccess: stillWithinPaidPeriod,
      phase: stillWithinPaidPeriod ? 'cancelling' : 'expired',
      trialDaysLeft: null,
      currentPeriodEnd: sub.current_period_end,
      plan,
    };
  }

  if (sub.status === 'trialing' && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at).getTime();
    if (trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd - now) / 86400000);
      return { hasAccess: true, phase: 'trial', trialDaysLeft: daysLeft, currentPeriodEnd: null, plan };
    }
  }

  if (sub.status === 'past_due') {
    return { hasAccess: false, phase: 'past_due', trialDaysLeft: null, currentPeriodEnd: sub.current_period_end, plan };
  }

  return { hasAccess: false, phase: 'expired', trialDaysLeft: 0, currentPeriodEnd: sub.current_period_end, plan };
}
