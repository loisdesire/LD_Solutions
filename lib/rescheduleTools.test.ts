import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Owner-facing bulk/single reschedule - propose_* only ever computes and
// persists a plan, apply_* is the only thing that moves a real booking
// and texts a real customer about it. Zero tests before this, despite a
// documented live bug already fixed in applyReschedule: a booking the
// customer cancelled themselves between propose and apply used to fall
// straight through to "applied: true", texting them that their
// (still-cancelled) appointment had been moved.
type TableResult = { data?: unknown; error?: unknown };

function makeTable() {
  const queue: TableResult[] = [];
  const insertPayloads: unknown[] = [];
  const updatePayloads: unknown[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = {
    select: () => self,
    insert: (arg: unknown) => {
      insertPayloads.push(arg);
      return self;
    },
    update: (arg: unknown) => {
      updatePayloads.push(arg);
      return self;
    },
    eq: () => self,
    neq: () => self,
    ilike: () => self,
    order: () => self,
    limit: () => self,
    gte: () => self,
    lt: () => self,
    gt: () => self,
    maybeSingle: () => Promise.resolve(next()),
    single: () => Promise.resolve(next()),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(next()).then(resolve, reject),
  };
  return {
    self,
    push: (...items: TableResult[]) => queue.push(...items),
    insertPayloads,
    updatePayloads,
    reset: () => {
      queue.length = 0;
      insertPayloads.length = 0;
      updatePayloads.length = 0;
    },
  };
}

const bookingsTable = makeTable();
const reschedulePlansTable = makeTable();
const TABLES: Record<string, ReturnType<typeof makeTable>> = {
  bookings: bookingsTable,
  reschedule_plans: reschedulePlansTable,
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

const getBusinessTimezoneMock = vi.fn();
vi.mock('./getBusinessTimezone', () => ({ getBusinessTimezone: (...args: unknown[]) => getBusinessTimezoneMock(...args) }));

const getAvailableSlotsMock = vi.fn();
vi.mock('./getAvailableSlots', () => ({ getAvailableSlots: (...args: unknown[]) => getAvailableSlotsMock(...args) }));

const notifyCustomerMock = vi.fn();
const getNotifyCredsMock = vi.fn();
vi.mock('./notifyCustomer', () => ({
  notifyCustomer: (...args: unknown[]) => notifyCustomerMock(...args),
  getNotifyCreds: (...args: unknown[]) => getNotifyCredsMock(...args),
}));

const { proposeReschedule, proposeBookingMove, applyReschedule } = await import('./rescheduleTools');

const BUSINESS_ID = 'biz-1';

beforeEach(() => {
  vi.resetAllMocks();
  for (const t of Object.values(TABLES)) t.reset();
  getBusinessTimezoneMock.mockResolvedValue('Africa/Lagos');
  getAvailableSlotsMock.mockResolvedValue([]);
  getNotifyCredsMock.mockResolvedValue({ name: 'Glow Salon' });
  notifyCustomerMock.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('proposeReschedule', () => {
  it('rejects a window whose end is not after its start', async () => {
    const result: any = await proposeReschedule(BUSINESS_ID, { date: '2026-06-01', startTime: '17:00', endTime: '09:00' });
    expect(result.error).toMatch(/end time must be after start time/i);
  });

  it('reports nothing to do when no bookings fall inside the window', async () => {
    bookingsTable.push({ data: [] });
    const result: any = await proposeReschedule(BUSINESS_ID, { date: '2026-06-01', startTime: '09:00', endTime: '17:00' });
    expect(result.affected_bookings).toBe(0);
  });

  it('builds a real plan with a next-available slot found per affected booking', async () => {
    bookingsTable.push({
      data: [
        {
          id: 'b1',
          customer_name: 'Amara',
          customer_phone: '+2348012345678',
          customer_telegram_username: null,
          customer_email: null,
          start_time: '2026-06-01T09:00:00.000Z',
          service_id: 'svc-1',
          services: { name: 'Haircut', duration_minutes: 30 },
        },
      ],
    });
    getAvailableSlotsMock.mockResolvedValueOnce(['2026-06-02T09:00:00.000Z']);
    reschedulePlansTable.push({ data: { id: 'plan-1' }, error: null });

    const result: any = await proposeReschedule(BUSINESS_ID, { date: '2026-06-01', startTime: '09:00', endTime: '17:00' });

    expect(result.plan_id).toBe('plan-1');
    expect(result.affected_bookings).toBe(1);
    expect(result.moves[0].customer).toBe('Amara');
    expect(reschedulePlansTable.insertPayloads[0]).toMatchObject({ status: 'pending' });
  });

  it('reports "needs manual handling" for a booking with no real slot found in the search window, without failing the whole plan', async () => {
    bookingsTable.push({
      data: [{ id: 'b1', customer_name: 'Amara', customer_phone: null, customer_telegram_username: null, customer_email: null, start_time: '2026-06-01T09:00:00.000Z', service_id: 'svc-1', services: { name: 'Haircut', duration_minutes: 30 } }],
    });
    getAvailableSlotsMock.mockResolvedValue([]); // every day in the search window comes back empty
    reschedulePlansTable.push({ data: { id: 'plan-1' }, error: null });

    const result: any = await proposeReschedule(BUSINESS_ID, { date: '2026-06-01', startTime: '09:00', endTime: '17:00' });

    expect(result.moves[0].to).toMatch(/needs manual handling/);
  });

  it('gives a friendly message rather than a raw Postgres error when the reschedule_plans table has not been migrated in yet', async () => {
    bookingsTable.push({
      data: [{ id: 'b1', customer_name: 'Amara', customer_phone: null, customer_telegram_username: null, customer_email: null, start_time: '2026-06-01T09:00:00.000Z', service_id: 'svc-1', services: { name: 'Haircut', duration_minutes: 30 } }],
    });
    reschedulePlansTable.push({ data: null, error: { code: 'PGRST205', message: 'relation not found' } });

    const result: any = await proposeReschedule(BUSINESS_ID, { date: '2026-06-01', startTime: '09:00', endTime: '17:00' });

    expect(result.error).toMatch(/isn't fully set up/);
  });
});

describe('proposeBookingMove', () => {
  it('errors when no upcoming booking matches the given name', async () => {
    bookingsTable.push({ data: [] });
    const result: any = await proposeBookingMove(BUSINESS_ID, { customerName: 'Nobody' });
    expect(result.error).toMatch(/no upcoming booking found/i);
  });

  it('needs disambiguation, and never guesses, when more than one upcoming booking matches', async () => {
    bookingsTable.push({
      data: [
        { id: 'b1', customer_name: 'Chioma', start_time: '2026-06-01T09:00:00Z', services: { name: 'Haircut', duration_minutes: 30 } },
        { id: 'b2', customer_name: 'Chioma A.', start_time: '2026-06-02T09:00:00Z', services: { name: 'Manicure', duration_minutes: 45 } },
      ],
    });
    const result: any = await proposeBookingMove(BUSINESS_ID, { customerName: 'Chioma' });
    expect(result.needs_disambiguation).toBe(true);
    expect(result.matches).toHaveLength(2);
  });

  it('refuses an explicit requested time that is not actually free, offering real alternatives instead of moving anything', async () => {
    bookingsTable.push({
      data: [{ id: 'b1', customer_name: 'Amara', start_time: '2026-06-01T09:00:00Z', end_time: '2026-06-01T09:30:00Z', service_id: 'svc-1', services: { name: 'Haircut', duration_minutes: 30 } }],
    });
    getAvailableSlotsMock.mockResolvedValueOnce(['2026-06-02T10:00:00.000Z']); // requested 09:00 not among them

    const result: any = await proposeBookingMove(BUSINESS_ID, { customerName: 'Amara', newDate: '2026-06-02', newTime: '09:00' });

    expect(result.error).toMatch(/isn't free/);
    expect(result.available_that_day).toHaveLength(1);
    expect(reschedulePlansTable.insertPayloads).toHaveLength(0);
  });

  it('builds a plan for an explicit requested time that genuinely is free', async () => {
    bookingsTable.push({
      data: [{ id: 'b1', customer_name: 'Amara', start_time: '2026-06-01T09:00:00Z', end_time: '2026-06-01T09:30:00Z', service_id: 'svc-1', services: { name: 'Haircut', duration_minutes: 30 } }],
    });
    getAvailableSlotsMock.mockResolvedValueOnce(['2026-06-02T09:00:00.000Z']); // Africa/Lagos 10:00 local = 09:00 UTC
    reschedulePlansTable.push({ data: { id: 'plan-1' }, error: null });

    const result: any = await proposeBookingMove(BUSINESS_ID, { customerName: 'Amara', newDate: '2026-06-02', newTime: '10:00' });

    expect(result.plan_id).toBe('plan-1');
    expect(result.affected_bookings).toBe(1);
  });

  it('finds wherever it next fits when no explicit time is named at all', async () => {
    bookingsTable.push({
      data: [{ id: 'b1', customer_name: 'Amara', start_time: '2026-06-01T09:00:00Z', end_time: '2026-06-01T09:30:00Z', service_id: 'svc-1', services: { name: 'Haircut', duration_minutes: 30 } }],
    });
    getAvailableSlotsMock.mockResolvedValueOnce(['2026-06-01T10:00:00.000Z']);
    reschedulePlansTable.push({ data: { id: 'plan-1' }, error: null });

    const result: any = await proposeBookingMove(BUSINESS_ID, { customerName: 'Amara' });

    expect(result.plan_id).toBe('plan-1');
  });
});

describe('applyReschedule', () => {
  it('errors when no plan id is given and there is no recent pending plan to fall back to', async () => {
    reschedulePlansTable.push({ data: null });
    const result: any = await applyReschedule(BUSINESS_ID, {});
    expect(result.error).toMatch(/no pending reschedule plan/i);
  });

  it('refuses to re-apply a plan that has already been applied - not a silent no-op, an honest error', async () => {
    reschedulePlansTable.push({ data: { id: 'plan-1', status: 'applied', moves: [] } });
    const result: any = await applyReschedule(BUSINESS_ID, { planId: 'plan-1' });
    expect(result.error).toMatch(/already applied/);
  });

  it('falls back to the business’s own most recent pending plan when no planId is given - a model replying to "yeah" a turn later has no way to know the exact id', async () => {
    reschedulePlansTable.push({ data: { id: 'plan-recent', status: 'pending', moves: [] } });
    const result: any = await applyReschedule(BUSINESS_ID, {});
    expect(result).toEqual({ applied: 0, needs_manual_handling: 0, results: [] });
  });

  it('reports a move with no available slot as needing manual handling, without attempting any database write for it', async () => {
    const move = { booking_id: 'b1', customer_name: 'Amara', service_name: 'Haircut', new_start: null, duration_minutes: 30 };
    reschedulePlansTable.push({ data: { id: 'plan-1', status: 'pending', moves: [move] } });

    const result: any = await applyReschedule(BUSINESS_ID, { planId: 'plan-1' });

    expect(result.results[0]).toMatchObject({ applied: false, detail: expect.stringMatching(/needs manual rescheduling/) });
    expect(bookingsTable.updatePayloads).toHaveLength(0);
  });

  it('moves a real booking and notifies the customer on a clean apply', async () => {
    const move = {
      booking_id: 'b1',
      customer_name: 'Amara',
      service_name: 'Haircut',
      new_start: '2026-06-02T09:00:00.000Z',
      new_when: 'Tue, Jun 2, 10:00 AM',
      old_when: 'Mon, Jun 1, 10:00 AM',
      duration_minutes: 30,
    };
    reschedulePlansTable.push({ data: { id: 'plan-1', status: 'pending', moves: [move] } });
    bookingsTable.push({ data: [{ id: 'b1' }], error: null });
    reschedulePlansTable.push({ error: null }); // mark plan applied

    const result: any = await applyReschedule(BUSINESS_ID, { planId: 'plan-1' });

    expect(result.results[0]).toMatchObject({ applied: true, notified: true });
    expect(notifyCustomerMock).toHaveBeenCalledTimes(1);
    expect(reschedulePlansTable.updatePayloads[0]).toEqual({ status: 'applied' });
  });

  it('never claims a cancelled-in-the-meantime booking was moved - the exact live bug this .neq/rowcount check exists to prevent', async () => {
    const move = { booking_id: 'b1', customer_name: 'Amara', service_name: 'Haircut', new_start: '2026-06-02T09:00:00.000Z', new_when: 'Tue', duration_minutes: 30 };
    reschedulePlansTable.push({ data: { id: 'plan-1', status: 'pending', moves: [move] } });
    // The .neq('status','cancelled') matched nothing - the customer
    // cancelled it themselves between propose and apply. Supabase reports
    // that as an empty array, not an error.
    bookingsTable.push({ data: [], error: null });
    reschedulePlansTable.push({ error: null });

    const result: any = await applyReschedule(BUSINESS_ID, { planId: 'plan-1' });

    expect(result.results[0]).toMatchObject({ applied: false, notified: false });
    expect(result.results[0].detail).toMatch(/no longer active/);
    expect(notifyCustomerMock).not.toHaveBeenCalled();
  });

  it('reports a real conflict (someone else took the slot between propose and apply) plainly, not as a generic failure', async () => {
    const move = { booking_id: 'b1', customer_name: 'Amara', service_name: 'Haircut', new_start: '2026-06-02T09:00:00.000Z', duration_minutes: 30 };
    reschedulePlansTable.push({ data: { id: 'plan-1', status: 'pending', moves: [move] } });
    bookingsTable.push({ data: null, error: { code: '23P01', message: 'conflict' } });
    reschedulePlansTable.push({ error: null });

    const result: any = await applyReschedule(BUSINESS_ID, { planId: 'plan-1' });

    expect(result.results[0].detail).toMatch(/booked by someone else/);
  });

  it('marks the plan applied even when some individual moves needed manual handling', async () => {
    const moveOk = { booking_id: 'b1', customer_name: 'Amara', service_name: 'Haircut', new_start: '2026-06-02T09:00:00.000Z', new_when: 'Tue', duration_minutes: 30 };
    const moveStuck = { booking_id: 'b2', customer_name: 'Tunde', service_name: 'Beard trim', new_start: null, duration_minutes: 15 };
    reschedulePlansTable.push({ data: { id: 'plan-1', status: 'pending', moves: [moveOk, moveStuck] } });
    bookingsTable.push({ data: [{ id: 'b1' }], error: null });
    reschedulePlansTable.push({ error: null });

    const result: any = await applyReschedule(BUSINESS_ID, { planId: 'plan-1' });

    expect(result.applied).toBe(1);
    expect(result.needs_manual_handling).toBe(1);
    expect(reschedulePlansTable.updatePayloads).toEqual([{ status: 'applied' }]);
  });
});
