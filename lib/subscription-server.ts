import { createClient } from '@supabase/supabase-js';
import { getSubscriptionState } from './subscription';

// Server-only half of subscription.ts — anything using the service-role
// key lives here specifically so a client component can safely import
// from subscription.ts (constants, types, the pure getSubscriptionState
// function) without accidentally pulling this module-scope
// createClient(..., SUPABASE_SERVICE_ROLE_KEY) call into the browser
// bundle, where the key is undefined and crashes on load.
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

// Gates the two deeper-AI features (the staff-only insights panel, and
// richer business-info answers in the public chat) — active access AND
// the higher plan, not just one or the other. Same defensive fallback as
// elsewhere in this codebase: if the `plan` column hasn't been migrated
// in yet, this just resolves to false (core-only) rather than erroring,
// since a select naming a nonexistent column fails as a whole unit.
export async function hasBusinessIntelligence(businessId: string): Promise<boolean> {
  const { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end, plan')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error?.code === '42703') {
    const fallback = await supabaseAdmin
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end')
      .eq('business_id', businessId)
      .maybeSingle();
    return getSubscriptionState(fallback.data).hasAccess && false; // plan column doesn't exist yet — never true
  }

  const state = getSubscriptionState(sub);
  return state.hasAccess && state.plan === 'business_intelligence';
}
