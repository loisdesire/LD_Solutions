import { beforeEach, describe, expect, it, vi } from 'vitest';

// Thin dispatcher over lib/rescheduleTools.ts, same shape and same reason
// to test as lib/insightsAgent.ts/lib/manageAgent.ts: the OpenAI tool
// schema speaks snake_case, the real functions take camelCase - this file
// is the only place that translates between them, and mocking
// rescheduleTools entirely lets each case's exact mapping be checked
// directly.
const rescheduleTools = {
  proposeReschedule: vi.fn(),
  proposeBookingMove: vi.fn(),
  applyReschedule: vi.fn(),
};
vi.mock('./rescheduleTools', () => rescheduleTools);

const { executeRescheduleTool, RESCHEDULE_TOOLS } = await import('./rescheduleAgent');

const BIZ = 'biz-1';

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(rescheduleTools).forEach((fn) => fn.mockResolvedValue({ ok: true }));
});

describe('executeRescheduleTool', () => {
  it('routes propose_reschedule, mapping start_time/end_time to camelCase and defaulting a missing reason to undefined', async () => {
    await executeRescheduleTool(
      'propose_reschedule',
      { date: '2026-06-01', start_time: '09:00', end_time: '12:00' },
      BIZ
    );
    expect(rescheduleTools.proposeReschedule).toHaveBeenCalledWith(BIZ, {
      date: '2026-06-01',
      startTime: '09:00',
      endTime: '12:00',
      reason: undefined,
    });
  });

  it('propose_reschedule passes reason through, stringified, when given', async () => {
    await executeRescheduleTool(
      'propose_reschedule',
      { date: '2026-06-01', start_time: '09:00', end_time: '12:00', reason: 'public holiday' },
      BIZ
    );
    expect(rescheduleTools.proposeReschedule).toHaveBeenCalledWith(
      BIZ,
      expect.objectContaining({ reason: 'public holiday' })
    );
  });

  it('routes propose_booking_move, mapping customer_name to camelCase and leaving new_date/new_time undefined when omitted', async () => {
    await executeRescheduleTool('propose_booking_move', { customer_name: 'Ada' }, BIZ);
    expect(rescheduleTools.proposeBookingMove).toHaveBeenCalledWith(BIZ, {
      customerName: 'Ada',
      newDate: undefined,
      newTime: undefined,
      reason: undefined,
    });
  });

  it('propose_booking_move passes new_date/new_time through when given', async () => {
    await executeRescheduleTool(
      'propose_booking_move',
      { customer_name: 'Ada', new_date: '2026-06-05', new_time: '10:00' },
      BIZ
    );
    expect(rescheduleTools.proposeBookingMove).toHaveBeenCalledWith(
      BIZ,
      expect.objectContaining({ newDate: '2026-06-05', newTime: '10:00' })
    );
  });

  it('routes apply_reschedule with a plan_id when given', async () => {
    await executeRescheduleTool('apply_reschedule', { plan_id: 'plan-123' }, BIZ);
    expect(rescheduleTools.applyReschedule).toHaveBeenCalledWith(BIZ, { planId: 'plan-123' });
  });

  it('apply_reschedule omits plan_id (undefined, not the model’s missing value coerced to a string) so it falls back to the business’s most recent plan', async () => {
    await executeRescheduleTool('apply_reschedule', {}, BIZ);
    expect(rescheduleTools.applyReschedule).toHaveBeenCalledWith(BIZ, { planId: undefined });
  });

  it('returns an error object for an unknown tool name rather than throwing', async () => {
    const result = await executeRescheduleTool('not_a_real_tool', {}, BIZ);
    expect(result).toEqual({ error: 'Unknown tool: not_a_real_tool' });
  });
});

describe('RESCHEDULE_TOOLS', () => {
  it('declares exactly one OpenAI tool schema per executeRescheduleTool case, with matching names', () => {
    const names = RESCHEDULE_TOOLS.map((t) => (t.type === 'function' ? t.function.name : null));
    expect(names).toEqual(['propose_reschedule', 'propose_booking_move', 'apply_reschedule']);
  });
});
