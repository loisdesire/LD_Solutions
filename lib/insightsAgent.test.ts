import { beforeEach, describe, expect, it, vi } from 'vitest';

// The dispatcher between OpenAI tool-call names (snake_case) and
// lib/insightsTools.ts's real functions (camelCase args) - thin, but
// exactly the kind of thin glue that silently broke once already in the
// sibling file (lib/manageAgent.ts's image_url/duration_minutes mapping
// bug). Every insights tool takes primitives only (no nested objects to
// get the casing wrong on), so this file mocks insightsTools entirely and
// checks each case routes to the right function with the right shape.
const insightsTools = {
  getRevenue: vi.fn(),
  getTopCustomers: vi.fn(),
  getTopServices: vi.fn(),
  getNextAppointment: vi.fn(),
  getBusinessSnapshot: vi.fn(),
  getCancellationsAndNoShows: vi.fn(),
  getBusiestTimes: vi.fn(),
  findCustomer: vi.fn(),
  getInactiveCustomers: vi.fn(),
  compareRevenuePeriods: vi.fn(),
  getBillingStatus: vi.fn(),
};
vi.mock('./insightsTools', () => insightsTools);

const { executeInsightsTool, INSIGHTS_TOOLS } = await import('./insightsAgent');

const BIZ = 'biz-1';

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(insightsTools).forEach((fn) => fn.mockResolvedValue({ ok: true }));
});

describe('executeInsightsTool', () => {
  it('routes get_revenue with from/to', async () => {
    await executeInsightsTool('get_revenue', { from: '2026-05-01', to: '2026-05-31' }, BIZ);
    expect(insightsTools.getRevenue).toHaveBeenCalledWith(BIZ, { from: '2026-05-01', to: '2026-05-31' });
  });

  it('routes get_top_customers with limit', async () => {
    await executeInsightsTool('get_top_customers', { limit: 3 }, BIZ);
    expect(insightsTools.getTopCustomers).toHaveBeenCalledWith(BIZ, { limit: 3 });
  });

  it('routes get_top_services with limit', async () => {
    await executeInsightsTool('get_top_services', { limit: 3 }, BIZ);
    expect(insightsTools.getTopServices).toHaveBeenCalledWith(BIZ, { limit: 3 });
  });

  it('routes get_next_appointment with just the businessId', async () => {
    await executeInsightsTool('get_next_appointment', {}, BIZ);
    expect(insightsTools.getNextAppointment).toHaveBeenCalledWith(BIZ);
  });

  it('routes get_business_snapshot with just the businessId', async () => {
    await executeInsightsTool('get_business_snapshot', {}, BIZ);
    expect(insightsTools.getBusinessSnapshot).toHaveBeenCalledWith(BIZ);
  });

  it('routes get_cancellations_and_no_shows with from/to', async () => {
    await executeInsightsTool('get_cancellations_and_no_shows', { from: '2026-05-01' }, BIZ);
    expect(insightsTools.getCancellationsAndNoShows).toHaveBeenCalledWith(BIZ, { from: '2026-05-01', to: undefined });
  });

  it('routes get_busiest_times with just the businessId', async () => {
    await executeInsightsTool('get_busiest_times', {}, BIZ);
    expect(insightsTools.getBusiestTimes).toHaveBeenCalledWith(BIZ);
  });

  it('routes find_customer, coercing the query to a string', async () => {
    await executeInsightsTool('find_customer', { query: 'Jane' }, BIZ);
    expect(insightsTools.findCustomer).toHaveBeenCalledWith(BIZ, { query: 'Jane' });
  });

  it('routes get_inactive_customers with days/limit', async () => {
    await executeInsightsTool('get_inactive_customers', { days: 30, limit: 5 }, BIZ);
    expect(insightsTools.getInactiveCustomers).toHaveBeenCalledWith(BIZ, { days: 30, limit: 5 });
  });

  it('routes compare_revenue_periods, passing from/to through as strings', async () => {
    await executeInsightsTool('compare_revenue_periods', { from: '2026-05-01', to: '2026-05-31' }, BIZ);
    expect(insightsTools.compareRevenuePeriods).toHaveBeenCalledWith(BIZ, { from: '2026-05-01', to: '2026-05-31' });
  });

  it('compare_revenue_periods omits from/to entirely (not the literal string "undefined") when the model leaves them out', async () => {
    await executeInsightsTool('compare_revenue_periods', {}, BIZ);
    expect(insightsTools.compareRevenuePeriods).toHaveBeenCalledWith(BIZ, { from: undefined, to: undefined });
  });

  it('routes get_billing_status with just the businessId', async () => {
    await executeInsightsTool('get_billing_status', {}, BIZ);
    expect(insightsTools.getBillingStatus).toHaveBeenCalledWith(BIZ);
  });

  it('returns an error object for an unknown tool name rather than throwing', async () => {
    const result = await executeInsightsTool('not_a_real_tool', {}, BIZ);
    expect(result).toEqual({ error: 'Unknown tool: not_a_real_tool' });
  });
});

describe('INSIGHTS_TOOLS', () => {
  it('declares exactly one OpenAI tool schema per executeInsightsTool case, with matching names', () => {
    const names = INSIGHTS_TOOLS.map((t) => (t.type === 'function' ? t.function.name : null));
    expect(names).toEqual([
      'get_revenue',
      'get_top_customers',
      'get_top_services',
      'get_next_appointment',
      'get_business_snapshot',
      'get_cancellations_and_no_shows',
      'get_busiest_times',
      'find_customer',
      'get_inactive_customers',
      'compare_revenue_periods',
      'get_billing_status',
    ]);
  });
});
