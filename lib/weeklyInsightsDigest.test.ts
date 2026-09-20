import { beforeEach, describe, expect, it, vi } from 'vitest';

// Deterministic weekly digest, deliberately reusing the exact same
// functions the on-demand insights chat calls (compareRevenuePeriods,
// getCancellationsAndNoShows) rather than reimplementing them - nothing
// here is generated text a bad week could turn embarrassing. Covers the
// formatting branches in buildWeeklyDigestRows and the join/filter logic
// in getWeeklyDigestRecipients (only a business with BOTH an active
// Business Intelligence subscription AND a real owner email qualifies).
type TableResult = { data?: unknown; error?: unknown };
function makeTable() {
  const queue: TableResult[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = {
    select: () => self,
    eq: () => self,
    neq: () => self,
    gte: () => self,
    lte: () => self,
    in: () => self,
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(next()).then(resolve, reject),
  };
  return { self, push: (...items: TableResult[]) => queue.push(...items), reset: () => { queue.length = 0; } };
}
const bookingsTable = makeTable();
const subscriptionsTable = makeTable();
const businessesTable = makeTable();
const staffTable = makeTable();
const TABLES: Record<string, ReturnType<typeof makeTable>> = {
  bookings: bookingsTable,
  subscriptions: subscriptionsTable,
  businesses: businessesTable,
  staff: staffTable,
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

const compareRevenuePeriodsMock = vi.fn();
const getCancellationsAndNoShowsMock = vi.fn();
vi.mock('./insightsTools', () => ({
  compareRevenuePeriods: (...args: unknown[]) => compareRevenuePeriodsMock(...args),
  getCancellationsAndNoShows: (...args: unknown[]) => getCancellationsAndNoShowsMock(...args),
}));

vi.mock('./formatMoney', () => ({ formatMoney: (n: number) => `₦${n}` }));
vi.mock('./logger', () => ({ logError: vi.fn() }));

const { buildWeeklyDigestRows, getWeeklyDigestRecipients } = await import('./weeklyInsightsDigest');

const BIZ = 'biz-1';

beforeEach(() => {
  vi.clearAllMocks();
  [bookingsTable, subscriptionsTable, businessesTable, staffTable].forEach((t) => t.reset());
  compareRevenuePeriodsMock.mockResolvedValue({
    current_period: { revenue: 50000, bookings: 5 },
    previous_period: { revenue: 40000, bookings: 4 },
    pct_change: 25,
  });
  getCancellationsAndNoShowsMock.mockResolvedValue({ total_bookings: 5, cancelled: 0, no_show: 0, completed: 5, confirmed: 0, cancelled_or_no_show_rate_pct: 0 });
});

describe('buildWeeklyDigestRows', () => {
  it('reports bookings and revenue with the week-over-week comparison when there was a previous week to compare to', async () => {
    bookingsTable.push({ data: [], error: null });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows).toContainEqual({ label: 'Bookings this week', value: '5 (was 4 last week)' });
    expect(rows).toContainEqual({ label: 'Revenue this week', value: '₦50000 (+25% vs last week)' });
  });

  it('omits the "was N last week" clause when there were no bookings at all last week', async () => {
    compareRevenuePeriodsMock.mockResolvedValue({
      current_period: { revenue: 50000, bookings: 5 },
      previous_period: { revenue: 0, bookings: 0 },
      pct_change: null,
    });
    bookingsTable.push({ data: [], error: null });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows).toContainEqual({ label: 'Bookings this week', value: '5' });
    expect(rows).toContainEqual({ label: 'Revenue this week', value: '₦50000' });
  });

  it('reports "Could not be calculated" rather than throwing when compareRevenuePeriods itself errors', async () => {
    compareRevenuePeriodsMock.mockResolvedValue({ error: 'to must be after from.' });
    bookingsTable.push({ data: [], error: null });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows).toContainEqual({ label: 'This week', value: 'Could not be calculated' });
  });

  it('names the most-booked service this week, with correct singular/plural wording', async () => {
    bookingsTable.push({
      data: [
        { services: { name: 'Haircut' } },
        { services: { name: 'Haircut' } },
        { services: { name: 'Beard trim' } },
      ],
      error: null,
    });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows).toContainEqual({ label: 'Most booked', value: 'Haircut (2 bookings)' });
  });

  it('uses singular "booking" when the top service was only booked once', async () => {
    bookingsTable.push({ data: [{ services: { name: 'Haircut' } }], error: null });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows).toContainEqual({ label: 'Most booked', value: 'Haircut (1 booking)' });
  });

  it('omits the "Most booked" row entirely when there were no bookings this week', async () => {
    bookingsTable.push({ data: [], error: null });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows.find((r) => r.label === 'Most booked')).toBeUndefined();
  });

  it('reports cancellations and no-shows together, correctly pluralized, only when at least one happened', async () => {
    getCancellationsAndNoShowsMock.mockResolvedValue({ total_bookings: 6, cancelled: 2, no_show: 1, completed: 3, confirmed: 0, cancelled_or_no_show_rate_pct: 50 });
    bookingsTable.push({ data: [], error: null });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows).toContainEqual({ label: 'Cancellations & no-shows', value: '2 cancelled, 1 no-show' });
  });

  it('omits the cancellations row entirely when there were none this week', async () => {
    getCancellationsAndNoShowsMock.mockResolvedValue({ total_bookings: 5, cancelled: 0, no_show: 0, completed: 5, confirmed: 0, cancelled_or_no_show_rate_pct: 0 });
    bookingsTable.push({ data: [], error: null });
    const rows = await buildWeeklyDigestRows(BIZ);
    expect(rows.find((r) => r.label === 'Cancellations & no-shows')).toBeUndefined();
  });
});

describe('getWeeklyDigestRecipients', () => {
  it('returns an empty list when no business has an active Business Intelligence subscription', async () => {
    subscriptionsTable.push({ data: [], error: null });
    const result = await getWeeklyDigestRecipients();
    expect(result).toEqual([]);
  });

  it('returns an empty list (not a crash) when the subscriptions query itself fails, e.g. a missing `plan` column on this deployment', async () => {
    subscriptionsTable.push({ data: null, error: { code: '42703' } });
    const result = await getWeeklyDigestRecipients();
    expect(result).toEqual([]);
  });

  it('joins business details to the owner’s email and includes only businesses that actually have one', async () => {
    subscriptionsTable.push({
      data: [
        { business_id: 'biz-with-owner', status: 'active', plan: 'business_intelligence' },
        { business_id: 'biz-no-owner', status: 'active', plan: 'business_intelligence' },
      ],
      error: null,
    });
    businessesTable.push({
      data: [
        { id: 'biz-with-owner', name: 'Glow Salon', slug: 'glow-salon', accent_color: '#C74A1E', logo_url: 'https://x/logo.png' },
        { id: 'biz-no-owner', name: 'No Owner Biz', slug: 'no-owner', accent_color: null, logo_url: null },
      ],
      error: null,
    });
    staffTable.push({ data: [{ business_id: 'biz-with-owner', email: 'owner@glow.com' }], error: null });

    const result = await getWeeklyDigestRecipients();

    expect(result).toEqual([
      { businessId: 'biz-with-owner', businessName: 'Glow Salon', slug: 'glow-salon', accentColor: '#C74A1E', logoUrl: 'https://x/logo.png', ownerEmail: 'owner@glow.com' },
    ]);
  });
});
