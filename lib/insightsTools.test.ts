import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Staff-facing business-intelligence reporting - the read-only counterpart
// to whatsappTools.ts. Every function here is scoped to one businessId and
// goes through the same shared fetchBookings() helper (except
// getCancellationsAndNoShows, getBillingStatus, and getNextAppointment,
// which deliberately run their own separate queries - see the source
// comments). fetchBookings excludes cancelled bookings everywhere except
// getCancellationsAndNoShows, which exists specifically to surface them.
type TableResult = { data?: unknown; error?: unknown; count?: number };

function makeTable() {
  const queue: TableResult[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = {
    select: () => self,
    eq: () => self,
    gte: () => self,
    lte: () => self,
    neq: () => self,
    order: () => self,
    limit: () => self,
    maybeSingle: () => Promise.resolve(next()),
    single: () => Promise.resolve(next()),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(next()).then(resolve, reject),
  };
  return {
    self,
    push: (...items: TableResult[]) => queue.push(...items),
    reset: () => {
      queue.length = 0;
    },
  };
}

const bookingsTable = makeTable();
const subscriptionsTable = makeTable();
const businessesTable = makeTable();
const TABLES: Record<string, ReturnType<typeof makeTable>> = {
  bookings: bookingsTable,
  subscriptions: subscriptionsTable,
  businesses: businessesTable,
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const t = TABLES[table];
      if (!t) throw new Error(`test double doesn't expect a query against "${table}"`);
      return t.self;
    },
  }),
}));

vi.mock('./logger', () => ({ logError: vi.fn() }));

const getBusinessTimezoneMock = vi.fn();
vi.mock('./getBusinessTimezone', () => ({ getBusinessTimezone: (...args: unknown[]) => getBusinessTimezoneMock(...args) }));

const todayInTimezoneMock = vi.fn();
vi.mock('./timezone', () => ({ todayInTimezone: (...args: unknown[]) => todayInTimezoneMock(...args) }));

const getSubscriptionStateMock = vi.fn();
vi.mock('./subscription', async () => {
  const actual = await vi.importActual<typeof import('./subscription')>('./subscription');
  return {
    ...actual,
    getSubscriptionState: (...args: unknown[]) => getSubscriptionStateMock(...args),
  };
});

const {
  getRevenue,
  getTopCustomers,
  getTopServices,
  getNextAppointment,
  getCancellationsAndNoShows,
  getBusiestTimes,
  findCustomer,
  getInactiveCustomers,
  compareRevenuePeriods,
  getBillingStatus,
  getBusinessSnapshot,
} = await import('./insightsTools');
const { PLAN_LABEL, PLAN_PRICE_NGN, BILLING_TIER_PRICE } = await import('./subscription');

function booking(overrides: Partial<{
  customer_name: string | null;
  customer_phone: string | null;
  start_time: string;
  status: string;
  services: { name: string; price: number | null } | { name: string; price: number | null }[] | null;
}> = {}) {
  return {
    customer_name: 'Jane Doe',
    customer_phone: '+2348000000001',
    start_time: '2026-05-10T10:00:00.000Z',
    status: 'confirmed',
    services: { name: 'Haircut', price: 5000 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  bookingsTable.reset();
  subscriptionsTable.reset();
  businessesTable.reset();
  getBusinessTimezoneMock.mockResolvedValue('UTC');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const BIZ = 'biz-1';

describe('getRevenue', () => {
  it('sums the price of every priced booking and counts unpriced ones separately', async () => {
    bookingsTable.push({
      data: [
        booking({ services: { name: 'Haircut', price: 5000 } }),
        booking({ services: { name: 'Beard trim', price: 3000 } }),
        booking({ services: null }),
      ],
      error: null,
    });

    const result = await getRevenue(BIZ, {});

    expect(result.total_revenue).toBe(8000);
    expect(result.bookings_counted).toBe(3);
    expect(result.priced_bookings).toBe(2);
    expect(result.range).toEqual({ from: 'all time', to: 'now' });
  });

  it('echoes the requested from/to range back instead of the "all time" defaults', async () => {
    bookingsTable.push({ data: [], error: null });
    const result = await getRevenue(BIZ, { from: '2026-05-01', to: '2026-05-31' });
    expect(result.range).toEqual({ from: '2026-05-01', to: '2026-05-31' });
  });
});

describe('getTopCustomers', () => {
  it('groups by phone number (the stable identifier), sums spend, and sorts by spend descending', async () => {
    bookingsTable.push({
      data: [
        booking({ customer_phone: '+2348000000001', customer_name: 'Jane', services: { name: 'Haircut', price: 5000 }, start_time: '2026-05-01T10:00:00.000Z' }),
        booking({ customer_phone: '+2348000000001', customer_name: 'Jane', services: { name: 'Beard trim', price: 3000 }, start_time: '2026-05-10T10:00:00.000Z' }),
        booking({ customer_phone: '+2348000000002', customer_name: 'Sam', services: { name: 'Haircut', price: 5000 }, start_time: '2026-05-05T10:00:00.000Z' }),
      ],
      error: null,
    });

    const result = await getTopCustomers(BIZ, {});

    expect(result.top_customers[0]).toEqual({ name: 'Jane', visits: 2, total_spend: 8000, last_visit: '2026-05-10T10:00:00.000Z' });
    expect(result.top_customers[1]).toEqual({ name: 'Sam', visits: 1, total_spend: 5000, last_visit: '2026-05-05T10:00:00.000Z' });
  });

  it('falls back to grouping by name for old rows with no phone on file', async () => {
    bookingsTable.push({
      data: [booking({ customer_phone: null, customer_name: 'Walk-in Wendy', services: { name: 'Haircut', price: 2000 } })],
      error: null,
    });
    const result = await getTopCustomers(BIZ, {});
    expect(result.top_customers[0].name).toBe('Walk-in Wendy');
  });

  it('respects the limit argument, defaulting to 5', async () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      booking({ customer_phone: `+234800000000${i}`, customer_name: `Customer ${i}`, services: { name: 'Haircut', price: 1000 * (i + 1) } })
    );
    bookingsTable.push({ data: rows, error: null });
    const defaultResult = await getTopCustomers(BIZ, {});
    expect(defaultResult.top_customers).toHaveLength(5);

    bookingsTable.push({ data: rows, error: null });
    const limited = await getTopCustomers(BIZ, { limit: 2 });
    expect(limited.top_customers).toHaveLength(2);
  });
});

describe('getTopServices', () => {
  it('counts bookings per service and sums revenue, sorted by booking count descending', async () => {
    bookingsTable.push({
      data: [
        booking({ services: { name: 'Haircut', price: 5000 } }),
        booking({ services: { name: 'Haircut', price: 5000 } }),
        booking({ services: { name: 'Beard trim', price: 3000 } }),
      ],
      error: null,
    });

    const result = await getTopServices(BIZ, {});

    expect(result.top_services[0]).toEqual({ name: 'Haircut', bookings: 2, revenue: 10000 });
    expect(result.top_services[1]).toEqual({ name: 'Beard trim', bookings: 1, revenue: 3000 });
  });

  it('skips bookings with no service on the row at all', async () => {
    bookingsTable.push({ data: [booking({ services: null })], error: null });
    const result = await getTopServices(BIZ, {});
    expect(result.top_services).toHaveLength(0);
  });
});

describe('getNextAppointment', () => {
  it('formats the soonest upcoming appointment in the business’s own timezone', async () => {
    getBusinessTimezoneMock.mockResolvedValue('Africa/Lagos');
    bookingsTable.push({
      data: { customer_name: 'Jane Doe', start_time: '2026-05-10T10:00:00.000Z', services: { name: 'Haircut' } },
      error: null,
    });

    const result = await getNextAppointment(BIZ);

    expect(result.next_appointment).not.toBeNull();
    expect(result.next_appointment?.customer).toBe('Jane Doe');
    expect(result.next_appointment?.service).toBe('Haircut');
  });

  it('unwraps a services embed that comes back as an array', async () => {
    bookingsTable.push({
      data: { customer_name: 'Jane Doe', start_time: '2026-05-10T10:00:00.000Z', services: [{ name: 'Haircut' }] },
      error: null,
    });
    const result = await getNextAppointment(BIZ);
    expect(result.next_appointment?.service).toBe('Haircut');
  });

  it('returns next_appointment: null when nothing is upcoming', async () => {
    bookingsTable.push({ data: null, error: null });
    const result = await getNextAppointment(BIZ);
    expect(result).toEqual({ next_appointment: null });
  });
});

describe('getCancellationsAndNoShows', () => {
  it('is the one function that counts cancelled bookings instead of excluding them', async () => {
    bookingsTable.push({
      data: [
        { status: 'confirmed' },
        { status: 'completed' },
        { status: 'cancelled' },
        { status: 'cancelled' },
        { status: 'no_show' },
      ],
      error: null,
    });

    const result = await getCancellationsAndNoShows(BIZ, {});

    expect(result.total_bookings).toBe(5);
    expect(result.cancelled).toBe(2);
    expect(result.no_show).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.confirmed).toBe(1);
    expect(result.cancelled_or_no_show_rate_pct).toBe(60);
  });

  it('returns a 0% rate rather than dividing by zero when there are no bookings at all', async () => {
    bookingsTable.push({ data: [], error: null });
    const result = await getCancellationsAndNoShows(BIZ, {});
    expect(result.cancelled_or_no_show_rate_pct).toBe(0);
  });
});

describe('getBusiestTimes', () => {
  it('breaks bookings down by day-of-week and hour-of-day in the business’s own timezone', async () => {
    getBusinessTimezoneMock.mockResolvedValue('UTC');
    bookingsTable.push({
      data: [
        booking({ start_time: '2026-05-11T09:00:00.000Z' }), // Monday
        booking({ start_time: '2026-05-11T09:30:00.000Z' }), // Monday, same hour
        booking({ start_time: '2026-05-12T14:00:00.000Z' }), // Tuesday
      ],
      error: null,
    });

    const result = await getBusiestTimes(BIZ);

    expect(result.busiest_day).toBe('Monday');
    expect(result.by_day.find((d) => d.day === 'Monday')?.bookings).toBe(2);
    expect(result.busiest_hour).toBe('09:00');
    expect(result.by_hour_top_5.length).toBeLessThanOrEqual(5);
  });

  it('returns busiest_hour: null (no hours seen) when there are no bookings - by_day is still fully zero-filled from DAY_NAMES, so busiest_day falls back to the first day in that list rather than null', async () => {
    bookingsTable.push({ data: [], error: null });
    const result = await getBusiestTimes(BIZ);
    expect(result.by_day.every((d) => d.bookings === 0)).toBe(true);
    expect(result.busiest_day).toBe('Sunday');
    expect(result.busiest_hour).toBeNull();
  });
});

describe('findCustomer', () => {
  it('matches on a case-insensitive substring of name or phone', async () => {
    bookingsTable.push({
      data: [
        booking({ customer_name: 'Jane Doe', customer_phone: '+2348000000001' }),
        booking({ customer_name: 'Sam Smith', customer_phone: '+2348000000002' }),
      ],
      error: null,
    });

    const result = await findCustomer(BIZ, { query: 'jane' });

    expect(result.found).toBe(true);
    if (result.found) expect(result.customers).toHaveLength(1);
  });

  it('reports found: false with a helpful message when nothing matches', async () => {
    bookingsTable.push({ data: [booking({ customer_name: 'Jane Doe' })], error: null });
    const result = await findCustomer(BIZ, { query: 'nobody' });
    expect(result.found).toBe(false);
    if (!result.found) expect(result.message).toMatch(/No customer matching/);
  });
});

describe('getInactiveCustomers', () => {
  it('flags a customer as inactive only when their last visit is older than the cutoff AND nothing is upcoming', async () => {
    const now = Date.now();
    const longAgo = new Date(now - 90 * 86400000).toISOString();
    const recentAndUpcoming = new Date(now + 5 * 86400000).toISOString();

    bookingsTable.push({
      data: [
        booking({ customer_phone: '+1', customer_name: 'Old Customer', start_time: longAgo }),
        booking({ customer_phone: '+2', customer_name: 'Still Coming', start_time: recentAndUpcoming }),
      ],
      error: null,
    });

    const result = await getInactiveCustomers(BIZ, { days: 60 });

    expect(result.inactive_customers).toHaveLength(1);
    expect(result.inactive_customers[0].name).toBe('Old Customer');
  });

  it('does not flag a customer whose last visit is recent even without an upcoming booking', async () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString();
    bookingsTable.push({ data: [booking({ customer_phone: '+1', start_time: recent })], error: null });
    const result = await getInactiveCustomers(BIZ, { days: 60 });
    expect(result.inactive_customers).toHaveLength(0);
  });
});

describe('compareRevenuePeriods', () => {
  it('defaults to this-month-so-far vs the immediately preceding period of equal length', async () => {
    bookingsTable.push(
      { data: [booking({ services: { name: 'Haircut', price: 5000 } })], error: null },
      { data: [booking({ services: { name: 'Haircut', price: 4000 } })], error: null }
    );

    const result = await compareRevenuePeriods(BIZ, {});

    expect(result.current_period?.revenue).toBe(5000);
    expect(result.previous_period?.revenue).toBe(4000);
    expect(result.pct_change).toBe(25);
  });

  it('returns pct_change: null rather than dividing by zero when the previous period had no revenue', async () => {
    bookingsTable.push(
      { data: [booking({ services: { name: 'Haircut', price: 5000 } })], error: null },
      { data: [], error: null }
    );
    const result = await compareRevenuePeriods(BIZ, {});
    expect(result.pct_change).toBeNull();
  });

  it('rejects an unparseable date instead of throwing on an Invalid Date - the actual fix for a 500 that used to reach the whole conversation', async () => {
    const result = await compareRevenuePeriods(BIZ, { from: 'not-a-date' });
    expect(result).toEqual({ error: 'Those dates could not be understood. Use ISO format, e.g. 2026-08-01.' });
  });

  it('rejects a to that is not after from', async () => {
    const result = await compareRevenuePeriods(BIZ, { from: '2026-05-10', to: '2026-05-01' });
    expect(result).toEqual({ error: 'to must be after from.' });
  });
});

describe('getBillingStatus', () => {
  it('delegates to getSubscriptionState and reports the plan label alongside it', async () => {
    subscriptionsTable.push({ data: { status: 'active', trial_ends_at: null, current_period_end: '2026-06-01T00:00:00.000Z', plan: 'core' }, error: null });
    businessesTable.push({ data: { home_country_code: 'NG' }, error: null });
    getSubscriptionStateMock.mockReturnValue({
      phase: 'active',
      hasAccess: true,
      trialDaysLeft: null,
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
      plan: 'core',
    });

    const result = await getBillingStatus(BIZ);

    expect(result.phase).toBe('active');
    expect(result.has_access).toBe(true);
    expect(result.plan).toBe(PLAN_LABEL.core);
  });

  // The actual gap this covers: get_billing_status used to unconditionally
  // report the flat NGN figure (monthly_price_ngn: PLAN_PRICE_NGN[plan]),
  // so a business outside Nigeria asking its own assistant "how much do I
  // pay" got told the wrong number for what it's actually billed - the
  // same class of bug the public landing page had. Fixed to report the
  // same geographic tier the checkout route and billing page already use.
  it('reports the geographically-tiered price for a core-plan business outside Nigeria, not the flat NGN figure', async () => {
    subscriptionsTable.push({ data: { status: 'active', trial_ends_at: null, current_period_end: null, plan: 'core' }, error: null });
    businessesTable.push({ data: { home_country_code: 'CA' }, error: null });
    getSubscriptionStateMock.mockReturnValue({
      phase: 'active',
      hasAccess: true,
      trialDaysLeft: null,
      currentPeriodEnd: null,
      plan: 'core',
    });

    const result = await getBillingStatus(BIZ);

    expect(result.monthly_price).toBe(BILLING_TIER_PRICE.INTL.amount);
    expect(result.monthly_price_currency).toBe('USD');
  });

  it('reports the flat NGN figure for a Nigerian core-plan business, same as before', async () => {
    subscriptionsTable.push({ data: { status: 'active', trial_ends_at: null, current_period_end: null, plan: 'core' }, error: null });
    businessesTable.push({ data: { home_country_code: 'NG' }, error: null });
    getSubscriptionStateMock.mockReturnValue({
      phase: 'active',
      hasAccess: true,
      trialDaysLeft: null,
      currentPeriodEnd: null,
      plan: 'core',
    });

    const result = await getBillingStatus(BIZ);

    expect(result.monthly_price).toBe(PLAN_PRICE_NGN.core);
    expect(result.monthly_price_currency).toBe('NGN');
  });

  it('never geo-tiers a legacy business_intelligence subscriber - they keep their historical flat NGN rate', async () => {
    subscriptionsTable.push({ data: { status: 'active', trial_ends_at: null, current_period_end: null, plan: 'business_intelligence' }, error: null });
    businessesTable.push({ data: { home_country_code: 'CA' }, error: null });
    getSubscriptionStateMock.mockReturnValue({
      phase: 'active',
      hasAccess: true,
      trialDaysLeft: null,
      currentPeriodEnd: null,
      plan: 'business_intelligence',
    });

    const result = await getBillingStatus(BIZ);

    expect(result.monthly_price).toBe(PLAN_PRICE_NGN.business_intelligence);
    expect(result.monthly_price_currency).toBe('NGN');
  });

  it('defaults to the NG tier when the business has no home_country_code on file', async () => {
    subscriptionsTable.push({ data: { status: 'active', trial_ends_at: null, current_period_end: null, plan: 'core' }, error: null });
    businessesTable.push({ data: null, error: null });
    getSubscriptionStateMock.mockReturnValue({
      phase: 'active',
      hasAccess: true,
      trialDaysLeft: null,
      currentPeriodEnd: null,
      plan: 'core',
    });

    const result = await getBillingStatus(BIZ);

    expect(result.monthly_price_currency).toBe('NGN');
  });

  it('falls back to a plan-less query on a missing-column (42703) error and passes plan: null through', async () => {
    subscriptionsTable.push(
      { data: null, error: { code: '42703' } },
      { data: { status: 'trial', trial_ends_at: '2026-06-01T00:00:00.000Z', current_period_end: null }, error: null }
    );
    businessesTable.push({ data: { home_country_code: 'NG' }, error: null });
    getSubscriptionStateMock.mockReturnValue({
      phase: 'trial',
      hasAccess: true,
      trialDaysLeft: 5,
      currentPeriodEnd: null,
      plan: 'core',
    });

    await getBillingStatus(BIZ);

    expect(getSubscriptionStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'trial', plan: null })
    );
  });

  it('passes null through to getSubscriptionState when the business has no subscription row at all', async () => {
    subscriptionsTable.push({ data: null, error: null });
    businessesTable.push({ data: { home_country_code: 'NG' }, error: null });
    getSubscriptionStateMock.mockReturnValue({
      phase: 'none',
      hasAccess: false,
      trialDaysLeft: null,
      currentPeriodEnd: null,
      plan: 'core',
    });

    await getBillingStatus(BIZ);

    expect(getSubscriptionStateMock).toHaveBeenCalledWith(null);
  });
});

describe('getBusinessSnapshot', () => {
  it('counts distinct customers across all time and revenue for the current month only', async () => {
    getBusinessTimezoneMock.mockResolvedValue('UTC');
    todayInTimezoneMock.mockReturnValue('2026-05-15');

    bookingsTable.push(
      {
        data: [
          booking({ customer_phone: '+1', services: { name: 'Haircut', price: 5000 } }),
          booking({ customer_phone: '+1', services: { name: 'Haircut', price: 5000 } }),
          booking({ customer_phone: '+2', services: { name: 'Haircut', price: 5000 } }),
        ],
        error: null,
      },
      { data: [booking({ customer_phone: '+1', services: { name: 'Haircut', price: 5000 } })], error: null }
    );

    const result = await getBusinessSnapshot(BIZ);

    expect(result.total_customers).toBe(2);
    expect(result.total_bookings_all_time).toBe(3);
    expect(result.bookings_this_month).toBe(1);
    expect(result.revenue_this_month).toBe(5000);
  });
});
