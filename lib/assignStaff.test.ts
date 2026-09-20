import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The actual "who does this booking go to" logic behind the staff-scoped
// no_overlapping_bookings exclusion constraint (see the file's own
// comment - before this, a business with three staff could only ever
// have ONE appointment at a time across its whole team). A wrong answer
// here either double-books a staff member (this IS the fast-path check
// the DB constraint is the final backstop for, not a redundant one) or
// wrongly reports "nobody's free" for a slot that's actually bookable.
// Had zero tests despite being exactly the kind of pure-decision-over-
// query-results logic this codebase's other tests already cover well.
const staffQuery = vi.fn();
const bookingsQuery = vi.fn();
const blockedTimesQuery = vi.fn();
let bookingsNeqCalls: unknown[][] = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'staff') {
        return { select: () => ({ eq: () => Promise.resolve(staffQuery()) }) };
      }
      if (table === 'bookings') {
        const self: any = {
          select: () => self,
          eq: () => self,
          not: () => self,
          lt: () => self,
          gt: () => self,
          neq: (...args: unknown[]) => {
            bookingsNeqCalls.push(args);
            return self;
          },
          then: (resolve: (v: unknown) => void) => Promise.resolve(bookingsQuery()).then(resolve),
        };
        return self;
      }
      if (table === 'blocked_times') {
        const self: any = {
          select: () => self,
          eq: () => self,
          lt: () => self,
          gt: () => self,
          then: (resolve: (v: unknown) => void) => Promise.resolve(blockedTimesQuery()).then(resolve),
        };
        return self;
      }
      throw new Error(`test double doesn't expect a query against "${table}"`);
    },
  }),
}));

const { pickAvailableStaffId } = await import('./assignStaff');

const START = '2026-01-01T10:00:00.000Z';
const END = '2026-01-01T10:30:00.000Z';

beforeEach(() => {
  vi.resetAllMocks();
  blockedTimesQuery.mockResolvedValue({ data: [] });
  bookingsNeqCalls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pickAvailableStaffId', () => {
  it('returns null when the business has no staff rows at all', async () => {
    staffQuery.mockResolvedValueOnce({ data: [] });
    const result = await pickAvailableStaffId('biz-1', START, END);
    expect(result).toBeNull();
  });

  it('returns the only staff member when nobody has a conflict', async () => {
    staffQuery.mockResolvedValueOnce({ data: [{ id: 'staff-a' }] });
    bookingsQuery.mockResolvedValueOnce({ data: [] });
    const result = await pickAvailableStaffId('biz-1', START, END);
    expect(result).toBe('staff-a');
  });

  it('picks the staff member who is NOT already booked in this window over the one who is', async () => {
    staffQuery.mockResolvedValueOnce({ data: [{ id: 'staff-a' }, { id: 'staff-b' }] });
    bookingsQuery.mockResolvedValueOnce({ data: [{ staff_id: 'staff-a' }] });
    const result = await pickAvailableStaffId('biz-1', START, END);
    expect(result).toBe('staff-b');
  });

  it('returns null when every staff member has a conflicting booking - genuinely nobody free', async () => {
    staffQuery.mockResolvedValueOnce({ data: [{ id: 'staff-a' }, { id: 'staff-b' }] });
    bookingsQuery.mockResolvedValueOnce({ data: [{ staff_id: 'staff-a' }, { staff_id: 'staff-b' }] });
    const result = await pickAvailableStaffId('biz-1', START, END);
    expect(result).toBeNull();
  });

  it('a staff-specific blocked-time entry takes just that one person out of the running', async () => {
    staffQuery.mockResolvedValueOnce({ data: [{ id: 'staff-a' }, { id: 'staff-b' }] });
    bookingsQuery.mockResolvedValueOnce({ data: [] });
    blockedTimesQuery.mockResolvedValueOnce({ data: [{ staff_id: 'staff-a' }] });

    const result = await pickAvailableStaffId('biz-1', START, END);
    expect(result).toBe('staff-b');
  });

  it('a business-wide block (staff_id null) means nobody is bookable, regardless of individual staff availability', async () => {
    staffQuery.mockResolvedValueOnce({ data: [{ id: 'staff-a' }, { id: 'staff-b' }] });
    bookingsQuery.mockResolvedValueOnce({ data: [] });
    blockedTimesQuery.mockResolvedValueOnce({ data: [{ staff_id: null }] });

    const result = await pickAvailableStaffId('biz-1', START, END);
    expect(result).toBeNull();
  });

  it('excludes the booking being rescheduled from its own conflict check, so a booking never conflicts with itself', async () => {
    staffQuery.mockResolvedValueOnce({ data: [{ id: 'staff-a' }] });
    bookingsQuery.mockResolvedValueOnce({ data: [] });

    await pickAvailableStaffId('biz-1', START, END, 0, 'booking-being-moved');

    expect(bookingsNeqCalls).toContainEqual(['id', 'booking-being-moved']);
  });

  it('does not filter by booking id at all when none is given (a fresh booking, not a reschedule)', async () => {
    staffQuery.mockResolvedValueOnce({ data: [{ id: 'staff-a' }] });
    bookingsQuery.mockResolvedValueOnce({ data: [] });

    await pickAvailableStaffId('biz-1', START, END);

    expect(bookingsNeqCalls.some(([field]) => field === 'id')).toBe(false);
  });
});
