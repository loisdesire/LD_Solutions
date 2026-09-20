import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOpenNow, summarizeHours } from './formatHours';

// summarizeHours condenses a raw weekly-hours table into the human
// summary shown on every business's public booking page ("Mon-Fri ·
// 9 AM-6 PM") - the day-range-collapsing loop is genuinely easy to get
// subtly wrong at its boundaries (a trailing single day, wraparound,
// more than one distinct hour-set in a week) and had zero tests. isOpenNow
// drives the live "open now"/"closed" indicator - wrong in either
// direction is a real, visible lie to a customer deciding whether to book.
describe('summarizeHours', () => {
  it('returns null for a business with no hours set at all', () => {
    expect(summarizeHours([])).toBeNull();
  });

  it('collapses a run of consecutive days with identical hours into one range', () => {
    const rows = [1, 2, 3, 4, 5].map((day_of_week) => ({ day_of_week, start_time: '09:00', end_time: '17:00' }));
    expect(summarizeHours(rows)).toBe('Mon-Fri · 9 AM-5 PM');
  });

  it('keeps a single non-consecutive day as its own segment, not folded into an adjacent range', () => {
    const rows = [
      { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
      { day_of_week: 2, start_time: '09:00', end_time: '17:00' },
      { day_of_week: 3, start_time: '09:00', end_time: '17:00' },
      { day_of_week: 5, start_time: '10:00', end_time: '18:00' },
    ];
    expect(summarizeHours(rows)).toBe('Mon-Wed · 9 AM-5 PM, Fri · 10 AM-6 PM');
  });

  it('formats an exact-hour time without minutes, and a non-exact time with them', () => {
    const rows = [{ day_of_week: 1, start_time: '09:00', end_time: '17:30' }];
    expect(summarizeHours(rows)).toBe('Mon · 9 AM-5:30 PM');
  });

  it('renders noon and midnight correctly (the classic 12 % 12 off-by-one)', () => {
    const rows = [{ day_of_week: 1, start_time: '00:00', end_time: '12:00' }];
    expect(summarizeHours(rows)).toBe('Mon · 12 AM-12 PM');
  });

  it('handles a single day open all seven days, correctly rendering the trailing boundary of the range', () => {
    const rows = [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({ day_of_week, start_time: '00:00', end_time: '23:00' }));
    expect(summarizeHours(rows)).toBe('Sun-Sat · 12 AM-11 PM');
  });
});

describe('isOpenNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is false when there are no hours at all', () => {
    expect(isOpenNow([], 'Africa/Lagos')).toBe(false);
  });

  it('is true during an open window, in the business’s own timezone', () => {
    // 2026-01-05 is a Monday. 10:00 WAT (UTC+1) = 09:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T09:00:00.000Z'));
    const rows = [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }];
    expect(isOpenNow(rows, 'Africa/Lagos')).toBe(true);
  });

  it('is false just before opening and at/after closing, on the correct local day', () => {
    vi.useFakeTimers();
    // 08:59 WAT Monday - one minute before opening.
    vi.setSystemTime(new Date('2026-01-05T07:59:00.000Z'));
    const rows = [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }];
    expect(isOpenNow(rows, 'Africa/Lagos')).toBe(false);

    // Exactly 17:00 WAT - closing time itself is not "open".
    vi.setSystemTime(new Date('2026-01-05T16:00:00.000Z'));
    expect(isOpenNow(rows, 'Africa/Lagos')).toBe(false);
  });

  it('is false on a day of week with no hours row, even if the time of day would otherwise be open', () => {
    vi.useFakeTimers();
    // 2026-01-04 is a Sunday, same 10:00 WAT.
    vi.setSystemTime(new Date('2026-01-04T09:00:00.000Z'));
    const rows = [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }]; // Monday only
    expect(isOpenNow(rows, 'Africa/Lagos')).toBe(false);
  });

  it('checks against the BUSINESS’s timezone, not the server’s - the same instant can be open in one zone and closed in another', () => {
    vi.useFakeTimers();
    // 09:00 UTC = 10:00 WAT (open, Lagos) = 04:00 EST (closed, New York).
    vi.setSystemTime(new Date('2026-01-05T09:00:00.000Z'));
    const rows = [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }];
    expect(isOpenNow(rows, 'Africa/Lagos')).toBe(true);
    expect(isOpenNow(rows, 'America/New_York')).toBe(false);
  });
});
