import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real availability computation - the whole reason a customer can't type
// any date/time they want. generateSlots itself (the actual slot-overlap
// math) already has full coverage of its own (lib/slotGenerator.test.ts)
// and is mocked here rather than re-tested - this file is about
// everything AROUND it: the early-return gates (no such service, date
// beyond the advance-booking window, closed that day), the stale-
// payment-hold sweep, and - the one piece of real logic unique to this
// file - expandBlocksToBusyIntervals, exercised indirectly by checking
// exactly what `booked` array reaches the mocked generateSlots call.
const servicesQuery = vi.fn();
const bookingRulesQuery = vi.fn();
const availabilityQuery = vi.fn();
const bookingsSelectQuery = vi.fn();
const bookingsUpdateQuery = vi.fn();
const staffCountQuery = vi.fn();
const blockedTimesQuery = vi.fn();
let bookingsSelectNeqCalls: unknown[][] = [];
let staleHoldUpdateCalled = false;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'services') return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(servicesQuery()) }) }) }) }) };
      if (table === 'booking_rules') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(bookingRulesQuery()) }) }) };
      if (table === 'availability') {
        const self: any = { select: () => self, eq: () => self, then: (r: (v: unknown) => void) => Promise.resolve(availabilityQuery()).then(r) };
        return self;
      }
      if (table === 'bookings') {
        const self: any = {
          select: () => self,
          eq: () => self,
          neq: (...args: unknown[]) => {
            bookingsSelectNeqCalls.push(args);
            return self;
          },
          gte: () => self,
          lte: () => self,
          lt: () => {
            staleHoldUpdateCalled = true;
            return Promise.resolve(bookingsUpdateQuery());
          },
          update: () => self,
          then: (r: (v: unknown) => void) => Promise.resolve(bookingsSelectQuery()).then(r),
        };
        return self;
      }
      if (table === 'staff') return { select: () => ({ eq: () => Promise.resolve(staffCountQuery()) }) };
      if (table === 'blocked_times') {
        const self: any = { select: () => self, eq: () => self, lte: () => self, gte: () => self, then: (r: (v: unknown) => void) => Promise.resolve(blockedTimesQuery()).then(r) };
        return self;
      }
      throw new Error(`test double doesn't expect a query against "${table}"`);
    },
  }),
}));

const getBusinessTimezoneMock = vi.fn();
vi.mock('./getBusinessTimezone', () => ({ getBusinessTimezone: (...args: unknown[]) => getBusinessTimezoneMock(...args) }));

const generateSlotsMock = vi.fn();
vi.mock('./slotGenerator', () => ({ generateSlots: (...args: unknown[]) => generateSlotsMock(...args) }));

const { getAvailableSlots, getAvailabilityForRange } = await import('./getAvailableSlots');

function futureDateStr(daysAhead: number, timeZone = 'UTC'): string {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
}

function futureIso(hoursAhead: number): string {
  return new Date(Date.now() + hoursAhead * 3600000).toISOString();
}

beforeEach(() => {
  vi.resetAllMocks();
  bookingsSelectNeqCalls = [];
  staleHoldUpdateCalled = false;
  getBusinessTimezoneMock.mockResolvedValue('UTC');
  bookingRulesQuery.mockResolvedValue({ data: { buffer_minutes: 0, max_advance_days: 30 } });
  bookingsUpdateQuery.mockResolvedValue({ error: null });
  staffCountQuery.mockResolvedValue({ count: 1 });
  blockedTimesQuery.mockResolvedValue({ data: [] });
  bookingsSelectQuery.mockResolvedValue({ data: [] });
  availabilityQuery.mockResolvedValue({ data: [{ start_time: '09:00', end_time: '17:00' }] });
  servicesQuery.mockResolvedValue({ data: { duration_minutes: 30 } });
  generateSlotsMock.mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAvailableSlots', () => {
  it('sweeps stale payment holds before answering, every call', async () => {
    await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1));
    expect(staleHoldUpdateCalled).toBe(true);
  });

  it('returns no slots when the service does not exist (or is inactive/another business’s)', async () => {
    servicesQuery.mockResolvedValueOnce({ data: null });
    const result = await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1));
    expect(result).toEqual([]);
    expect(generateSlotsMock).not.toHaveBeenCalled();
  });

  it('returns no slots for a date beyond max_advance_days', async () => {
    bookingRulesQuery.mockResolvedValueOnce({ data: { buffer_minutes: 0, max_advance_days: 5 } });
    const result = await getAvailableSlots('biz-1', 'svc-1', futureDateStr(10));
    expect(result).toEqual([]);
    expect(generateSlotsMock).not.toHaveBeenCalled();
  });

  it('returns no slots for a date that has already passed', async () => {
    const result = await getAvailableSlots('biz-1', 'svc-1', futureDateStr(-3));
    expect(result).toEqual([]);
  });

  it('returns no slots when the business is closed that day of week (no working-hours rows)', async () => {
    availabilityQuery.mockResolvedValueOnce({ data: [] });
    const result = await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1));
    expect(result).toEqual([]);
    expect(generateSlotsMock).not.toHaveBeenCalled();
  });

  it('passes the real service duration and buffer through to generateSlots', async () => {
    servicesQuery.mockResolvedValueOnce({ data: { duration_minutes: 45 } });
    bookingRulesQuery.mockResolvedValueOnce({ data: { buffer_minutes: 15, max_advance_days: 30 } });

    await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1));

    expect(generateSlotsMock).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 45, bufferMinutes: 15 }));
  });

  it('a staff-specific blocked time contributes exactly one busy interval, a business-wide block contributes one per staff seat', async () => {
    staffCountQuery.mockResolvedValueOnce({ count: 3 });
    blockedTimesQuery.mockResolvedValueOnce({
      data: [
        { start_time: '2026-01-01T09:00:00Z', end_time: '2026-01-01T09:30:00Z', staff_id: 'staff-a' },
        { start_time: '2026-01-01T10:00:00Z', end_time: '2026-01-01T10:30:00Z', staff_id: null },
      ],
    });

    await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1));

    const call = generateSlotsMock.mock.calls[0][0];
    const staffSpecific = call.booked.filter((b: { start_time: string }) => b.start_time === '2026-01-01T09:00:00Z');
    const businessWide = call.booked.filter((b: { start_time: string }) => b.start_time === '2026-01-01T10:00:00Z');
    expect(staffSpecific).toHaveLength(1);
    expect(businessWide).toHaveLength(3);
    expect(call.staffCapacity).toBe(3);
  });

  it('combines real bookings and expanded blocks into one booked array for generateSlots', async () => {
    bookingsSelectQuery.mockResolvedValueOnce({ data: [{ start_time: '2026-01-01T09:00:00Z', end_time: '2026-01-01T09:30:00Z' }] });
    blockedTimesQuery.mockResolvedValueOnce({ data: [{ start_time: '2026-01-01T11:00:00Z', end_time: '2026-01-01T11:30:00Z', staff_id: 'staff-a' }] });

    await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1));

    const call = generateSlotsMock.mock.calls[0][0];
    expect(call.booked).toHaveLength(2);
  });

  it('excludes the booking being rescheduled from the conflict check', async () => {
    await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1), 'booking-being-moved');
    expect(bookingsSelectNeqCalls).toContainEqual(['id', 'booking-being-moved']);
  });

  it('filters out any generated slot that has already passed, even on a bookable date', async () => {
    const past = futureIso(-1);
    const soon = futureIso(2);
    const later = futureIso(5);
    generateSlotsMock.mockReturnValueOnce([past, soon, later]);
    const result = await getAvailableSlots('biz-1', 'svc-1', futureDateStr(1));
    expect(result).toEqual([soon, later]);
  });
});

describe('getAvailabilityForRange', () => {
  it('caps the range at 42 days regardless of how wide a range is requested', async () => {
    const result = await getAvailabilityForRange('biz-1', 'svc-1', futureDateStr(0), futureDateStr(365));
    expect(Object.keys(result).length).toBeLessThanOrEqual(42);
  });

  it('marks a date beyond max_advance_days as false without ever asking generateSlots about it', async () => {
    bookingRulesQuery.mockResolvedValueOnce({ data: { buffer_minutes: 0, max_advance_days: 2 } });
    const start = futureDateStr(0);
    const end = futureDateStr(5);

    const result = await getAvailabilityForRange('biz-1', 'svc-1', start, end);

    expect(result[futureDateStr(5)]).toBe(false);
    expect(generateSlotsMock.mock.calls.some((c) => c[0].dateISO === futureDateStr(5))).toBe(false);
  });

  it('marks a closed day of week as false without calling generateSlots for it', async () => {
    availabilityQuery.mockResolvedValueOnce({ data: [] }); // closed every day
    const result = await getAvailabilityForRange('biz-1', 'svc-1', futureDateStr(0), futureDateStr(2));
    expect(Object.values(result).every((v) => v === false)).toBe(true);
    expect(generateSlotsMock).not.toHaveBeenCalled();
  });

  it('reports true for a date generateSlots returns at least one future slot for, false otherwise', async () => {
    availabilityQuery.mockResolvedValueOnce({
      data: [
        { day_of_week: new Date(futureDateStr(0)).getUTCDay(), start_time: '09:00', end_time: '17:00' },
        { day_of_week: new Date(futureDateStr(1)).getUTCDay(), start_time: '09:00', end_time: '17:00' },
      ],
    });
    generateSlotsMock.mockReturnValueOnce([futureIso(5)]).mockReturnValueOnce([futureIso(-5)]);

    const result = await getAvailabilityForRange('biz-1', 'svc-1', futureDateStr(0), futureDateStr(1));

    expect(result[futureDateStr(0)]).toBe(true);
    expect(result[futureDateStr(1)]).toBe(false);
  });
});
