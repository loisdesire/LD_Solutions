import { createClient } from '@supabase/supabase-js';

// Referenced by both the billing page (what it shows) and the checkout
// route (what it actually charges), so there's exactly one number to change.
export const MONTHLY_PRICE_NGN = 20000;

export type Subscription = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
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
};

// Centralizes "is this business allowed in" so it's computed the same way
// everywhere (the access gate, and the billing page showing status) — a
// naive `status === 'active'` check alone would incorrectly lock out
// someone still inside their trial window, or cut off someone who
// cancelled but already paid through the end of their current period.
export function getSubscriptionState(sub: Subscription | null): SubscriptionState {
  if (!sub) return { hasAccess: false, phase: 'none', trialDaysLeft: null, currentPeriodEnd: null };

  const now = Date.now();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const stillWithinPaidPeriod = periodEnd !== null && periodEnd > now;

  if (sub.status === 'active') {
    return { hasAccess: true, phase: 'active', trialDaysLeft: null, currentPeriodEnd: sub.current_period_end };
  }

  if (sub.status === 'cancelled') {
    // Cancelling stops future renewals, but doesn't claw back time they
    // already paid for.
    return {
      hasAccess: stillWithinPaidPeriod,
      phase: stillWithinPaidPeriod ? 'cancelling' : 'expired',
      trialDaysLeft: null,
      currentPeriodEnd: sub.current_period_end,
    };
  }

  if (sub.status === 'trialing' && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at).getTime();
    if (trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd - now) / 86400000);
      return { hasAccess: true, phase: 'trial', trialDaysLeft: daysLeft, currentPeriodEnd: null };
    }
  }

  if (sub.status === 'past_due') {
    return { hasAccess: false, phase: 'past_due', trialDaysLeft: null, currentPeriodEnd: sub.current_period_end };
  }

  return { hasAccess: false, phase: 'expired', trialDaysLeft: 0, currentPeriodEnd: sub.current_period_end };
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The subscription gate (requireStaffSession) only ever protected the
// admin dashboard — the actual service being paid for (accepting bookings,
// on the website and through the AI agent on every channel) had no check
// at all, so a business past its trial/cancelled kept taking real bookings
// it had no way to see or manage. Every path that creates a booking on a
// customer's behalf — the public booking form and the AI agent's
// create_booking tool — should call this first. Uses the service role key
// deliberately: this runs from public/anonymous contexts (a customer
// filling out a form, a webhook from WhatsApp) that never have a staff
// session, unlike requireStaffSession's own RLS-scoped query.
export async function canAcceptBookings(businessId: string): Promise<boolean> {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end')
    .eq('business_id', businessId)
    .maybeSingle();

  return getSubscriptionState(sub).hasAccess;
}
