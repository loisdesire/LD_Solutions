import { describe, it, expect } from 'vitest';
import { zonedTimeToUtc, todayInTimezone, dayOfWeekForDate, daysBetween } from './timezone';

describe('zonedTimeToUtc', () => {
  it('converts a Lagos wall-clock time (UTC+1, no DST) to UTC', () => {
    const result = zonedTimeToUtc('2026-07-13', '09:00', 'Africa/Lagos');
    expect(result.toISOString()).toBe('2026-07-13T08:00:00.000Z');
  });

  it('converts a New York wall-clock time to UTC, accounting for DST (EDT in July)', () => {
    const result = zonedTimeToUtc('2026-07-13', '09:00', 'America/New_York');
    expect(result.toISOString()).toBe('2026-07-13T13:00:00.000Z');
  });

  it('converts the same New York wall-clock time correctly outside DST (EST in January)', () => {
    const result = zonedTimeToUtc('2026-01-13', '09:00', 'America/New_York');
    expect(result.toISOString()).toBe('2026-01-13T14:00:00.000Z');
  });

  it('treats UTC as a no-op', () => {
    const result = zonedTimeToUtc('2026-07-13', '09:00', 'UTC');
    expect(result.toISOString()).toBe('2026-07-13T09:00:00.000Z');
  });
});

describe('dayOfWeekForDate', () => {
  it('is independent of server timezone - 2026-07-11 is a Saturday', () => {
    expect(dayOfWeekForDate('2026-07-11')).toBe(6);
  });

  it('2026-07-12 is a Sunday', () => {
    expect(dayOfWeekForDate('2026-07-12')).toBe(0);
  });

  it('2026-07-13 is a Monday', () => {
    expect(dayOfWeekForDate('2026-07-13')).toBe(1);
  });
});

describe('daysBetween', () => {
  it('is 0 for the same date', () => {
    expect(daysBetween('2026-07-12', '2026-07-12')).toBe(0);
  });

  it('counts forward correctly', () => {
    expect(daysBetween('2026-07-12', '2026-08-11')).toBe(30);
  });

  it('counts negative for a date in the past', () => {
    expect(daysBetween('2026-07-12', '2026-07-11')).toBe(-1);
  });
});

describe('todayInTimezone', () => {
  it('returns a well-formed YYYY-MM-DD string', () => {
    expect(todayInTimezone('Africa/Lagos')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
