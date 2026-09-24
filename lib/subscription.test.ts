import { describe, expect, it } from 'vitest';
import { getSubscriptionState, getBillingTier, BILLING_TIER_PRICE, PLAN_PRICE_NGN } from './subscription';

// getSubscriptionState is the one function that decides whether a
// business is let into its own admin area (via requireStaffSession) AND
// whether it's allowed to keep taking real bookings on every channel
// (canAcceptBookings) - a wrong branch here either locks out a business
// that's actually paid, or lets one that's lapsed keep using the product
// for free indefinitely. Zero tests existed for this despite the amount
// of branching (active/cancelling/trialing/past_due/expired/none) and a
// documented history of live bugs in the surrounding billing display
// logic (see BillingManager's "One plan now" comment referenced inside
// this file). Pure function, no mocking needed.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('getSubscriptionState', () => {
  it('has no access at all when there is no subscription row - never a silent free pass', () => {
    const state = getSubscriptionState(null);
    expect(state).toEqual({ hasAccess: false, phase: 'none', trialDaysLeft: null, currentPeriodEnd: null, plan: 'core' });
  });

  it('grants access on an active subscription, regardless of period end', () => {
    const state = getSubscriptionState({ status: 'active', trial_ends_at: null, current_period_end: null });
    expect(state.hasAccess).toBe(true);
    expect(state.phase).toBe('active');
  });

  it('an active subscription reports its own real plan, even the legacy business_intelligence tier', () => {
    const state = getSubscriptionState({
      status: 'active',
      trial_ends_at: null,
      current_period_end: null,
      plan: 'business_intelligence',
    });
    expect(state.plan).toBe('business_intelligence');
  });

  it('a cancelled subscription still within its paid period keeps access - cancelling stops renewal, not time already paid for', () => {
    const state = getSubscriptionState({
      status: 'cancelled',
      trial_ends_at: null,
      current_period_end: new Date(Date.now() + 3 * DAY).toISOString(),
    });
    expect(state).toMatchObject({ hasAccess: true, phase: 'cancelling' });
  });

  it('a cancelled subscription past its paid period loses access', () => {
    const state = getSubscriptionState({
      status: 'cancelled',
      trial_ends_at: null,
      current_period_end: new Date(Date.now() - 3 * DAY).toISOString(),
    });
    expect(state).toMatchObject({ hasAccess: false, phase: 'expired' });
  });

  it('a cancelled subscription with no current_period_end at all loses access - never trust a missing date as "still covered"', () => {
    const state = getSubscriptionState({ status: 'cancelled', trial_ends_at: null, current_period_end: null });
    expect(state).toMatchObject({ hasAccess: false, phase: 'expired' });
  });

  it('an active trial grants access and reports days left, rounded up', () => {
    const state = getSubscriptionState({
      status: 'trialing',
      trial_ends_at: new Date(Date.now() + 2.1 * DAY).toISOString(),
      current_period_end: null,
    });
    expect(state.hasAccess).toBe(true);
    expect(state.phase).toBe('trial');
    expect(state.trialDaysLeft).toBe(3);
  });

  it('a trial always previews the real Core price, even for a row carrying the stale business_intelligence plan from before pricing was simplified', () => {
    const state = getSubscriptionState({
      status: 'trialing',
      trial_ends_at: new Date(Date.now() + DAY).toISOString(),
      current_period_end: null,
      plan: 'business_intelligence',
    });
    expect(state.plan).toBe('core');
  });

  it('an expired trial loses access, even though status is still "trialing" in the row', () => {
    const state = getSubscriptionState({
      status: 'trialing',
      trial_ends_at: new Date(Date.now() - HOUR).toISOString(),
      current_period_end: null,
    });
    expect(state.hasAccess).toBe(false);
    expect(state.phase).toBe('expired');
  });

  it('"trialing" status with no trial_ends_at at all falls through to expired rather than granting an open-ended trial', () => {
    const state = getSubscriptionState({ status: 'trialing', trial_ends_at: null, current_period_end: null });
    expect(state.hasAccess).toBe(false);
  });

  it('past_due has no access, regardless of a future current_period_end - unlike cancelling, a failed charge does not buy more time', () => {
    const state = getSubscriptionState({
      status: 'past_due',
      trial_ends_at: null,
      current_period_end: new Date(Date.now() + 3 * DAY).toISOString(),
    });
    expect(state).toMatchObject({ hasAccess: false, phase: 'past_due' });
  });

  it('an unrecognized status falls through to expired/no access rather than defaulting open', () => {
    const state = getSubscriptionState({ status: 'some_future_status_this_code_does_not_know_about', trial_ends_at: null, current_period_end: null });
    expect(state).toMatchObject({ hasAccess: false, phase: 'expired' });
  });

  it('an unset plan on the row normalizes to core, never an unrecognized value', () => {
    const state = getSubscriptionState({ status: 'active', trial_ends_at: null, current_period_end: null, plan: null });
    expect(state.plan).toBe('core');
  });
});

// getBillingTier decides which of four real currencies a business
// actually gets charged (checkout route) and shown (billing page, and
// now the public landing page too) - a wrong branch here is a wrong
// amount of real money moving, not just a display bug. Ordering matters:
// NG and GH are checked before the African-country-code set is ever
// consulted, since both are themselves African countries and would
// otherwise fall into the generic AFRICA tier instead of their own
// correctly-priced one.
describe('getBillingTier', () => {
  it('defaults to NG for a null/undefined country code - a failed or not-yet-run geolocation, the existing safe default', () => {
    expect(getBillingTier(null)).toBe('NG');
    expect(getBillingTier(undefined)).toBe('NG');
  });

  it('resolves Nigeria and Ghana to their own tiers, not the generic AFRICA one', () => {
    expect(getBillingTier('NG')).toBe('NG');
    expect(getBillingTier('GH')).toBe('GH');
  });

  it('resolves any other African Union country to the AFRICA tier', () => {
    expect(getBillingTier('KE')).toBe('AFRICA');
    expect(getBillingTier('ZA')).toBe('AFRICA');
  });

  it('resolves anywhere outside Africa to the INTL tier', () => {
    expect(getBillingTier('CA')).toBe('INTL');
    expect(getBillingTier('US')).toBe('INTL');
    expect(getBillingTier('GB')).toBe('INTL');
  });

  it('an unrecognized/malformed country code falls through to INTL rather than crashing or defaulting to NG', () => {
    expect(getBillingTier('XX')).toBe('INTL');
  });
});

describe('BILLING_TIER_PRICE', () => {
  it('prices NG in Naira at the shared PLAN_PRICE_NGN.core figure, not a second hardcoded number to drift out of sync', () => {
    expect(BILLING_TIER_PRICE.NG).toEqual({ amount: PLAN_PRICE_NGN.core, currency: 'NGN' });
  });

  it('prices every non-NG tier in its own real currency', () => {
    expect(BILLING_TIER_PRICE.GH).toEqual({ amount: 120, currency: 'GHS' });
    expect(BILLING_TIER_PRICE.AFRICA).toEqual({ amount: 10, currency: 'USD' });
    expect(BILLING_TIER_PRICE.INTL).toEqual({ amount: 15, currency: 'USD' });
  });
});
