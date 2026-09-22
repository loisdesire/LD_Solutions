// Client-safe only - no Supabase client, no service-role key. BillingManager
// (a client component) imports PLAN_PRICE_NGN/PLAN_LABEL from here; anything
// with a module-scope `createClient(..., SUPABASE_SERVICE_ROLE_KEY)` call
// belongs in subscription-server.ts instead; SUPABASE_SERVICE_ROLE_KEY isn't
// NEXT_PUBLIC_-prefixed, so it's undefined in a client bundle and crashes
// the whole module at evaluation time - "supabaseKey is required" - the
// instant anything client-side imports even one unrelated export from a
// file that also does that at the top level.

import { AFRICAN_COUNTRY_CODES } from './africanCountries';

export type Plan = 'core' | 'business_intelligence';

// Referenced by both the billing page (what it shows) and the checkout
// route (what it actually charges), so there's exactly one number to change
// per plan. Both AI receptionist booking capability and the dashboard are
// in 'core' - the thing 'business_intelligence' actually adds is deeper AI
// access: the owner-facing insights panel, and richer business-info
// answers in the public chat (top services, etc). It is NOT "AI vs no AI" -
// every plan gets the same booking AI, since that's the entire premise of
// the product, not an upsell.
export const PLAN_PRICE_NGN: Record<Plan, number> = {
  core: 15000,
  business_intelligence: 25000,
};

export const PLAN_LABEL: Record<Plan, string> = {
  core: 'Core',
  business_intelligence: 'Business Intelligence',
};

// Geographic pricing - only 'core' (the only plan sold at all now, per
// PLAN_PRICE_NGN's own comment) gets tiered by country. Settled after an
// actual pricing discussion (not guessed): Nigeria/Ghana keep real local
// pricing, other African countries get a real discount off the
// international rate rather than being lumped in with it, and nobody is
// ever asked to self-report which tier they're in - home_country_code
// (supabase/schema.sql) is geolocated once at signup, never a choice
// offered to the business itself.
export type BillingTier = 'NG' | 'GH' | 'AFRICA' | 'INTL';

export const BILLING_TIER_PRICE: Record<BillingTier, { amount: number; currency: string }> = {
  NG: { amount: PLAN_PRICE_NGN.core, currency: 'NGN' },
  GH: { amount: 120, currency: 'GHS' },
  AFRICA: { amount: 10, currency: 'USD' },
  INTL: { amount: 15, currency: 'USD' },
};

// null/undefined (the column doesn't exist yet on this database, the
// geolocation lookup failed, or a business predates this feature) reads
// as NG - fails closed to the existing, safe, already-correct-for-most-
// businesses default, rather than an unrelated hiccup landing someone on
// a different tier than intended. Shared by the checkout route and the
// billing page's own price display so both agree on the same tier
// without recomputing the rule differently in two places.
export function getBillingTier(homeCountryCode: string | null | undefined): BillingTier {
  if (!homeCountryCode || homeCountryCode === 'NG') return 'NG';
  if (homeCountryCode === 'GH') return 'GH';
  return AFRICAN_COUNTRY_CODES.has(homeCountryCode) ? 'AFRICA' : 'INTL';
}

export type Subscription = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan?: string | null;
};

export type SubscriptionState = {
  // Whether the business should actually be let into the admin area right
  // now - the one thing every call site actually cares about.
  hasAccess: boolean;
  // 'trial' | 'active' | 'cancelling' | 'past_due' | 'expired' | 'none' -
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
// everywhere (the access gate, and the billing page showing status) - a
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
      // 'core' unconditionally, not the stored `plan` - a trial preview
      // should show what actually happens if they subscribe, and every
      // subscribe action charges Core now (see BillingManager's "One plan
      // now" comment). A business created before the pricing
      // simplification can still have 'business_intelligence' sitting in
      // its row from back when that was a real, separately-priced tier -
      // showing that stale value during a live trial made it look like
      // subscribing would charge ₦25,000 when it's actually ₦15,000,
      // confirmed live on a real trial account. An already-active
      // subscriber on the legacy rate (the `active`/`cancelling` branches
      // above) still shows their real stored plan, correctly, since
      // they're genuinely paying that amount until it changes.
      return { hasAccess: true, phase: 'trial', trialDaysLeft: daysLeft, currentPeriodEnd: null, plan: 'core' };
    }
  }

  if (sub.status === 'past_due') {
    return { hasAccess: false, phase: 'past_due', trialDaysLeft: null, currentPeriodEnd: sub.current_period_end, plan };
  }

  return { hasAccess: false, phase: 'expired', trialDaysLeft: 0, currentPeriodEnd: sub.current_period_end, plan };
}
