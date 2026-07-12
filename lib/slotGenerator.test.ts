import { describe, it, expect } from 'vitest';
import { generateSlots } from './slotGenerator';

const baseArgs = {
  dateISO: '2026-07-13', // a Monday
  timeZone: 'UTC',
  hours: [{ start_time: '09:00', end_time: '17:00' }],
  durationMinutes: 45,
  bufferMinutes: 0,
  booked: [],
};

describe('generateSlots', () => {
  it('generates 10 evenly-spaced 45-minute slots across an 8-hour window with no bookings', () => {
    const slots = generateSlots(baseArgs);
    expect(slots).toEqual([
      '2026-07-13T09:00:00.000Z',
      '2026-07-13T09:45:00.000Z',
      '2026-07-13T10:30:00.000Z',
      '2026-07-13T11:15:00.000Z',
      '2026-07-13T12:00:00.000Z',
      '2026-07-13T12:45:00.000Z',
      '2026-07-13T13:30:00.000Z',
      '2026-07-13T14:15:00.000Z',
      '2026-07-13T15:00:00.000Z',
      '2026-07-13T15:45:00.000Z',
    ]);
  });

  it('excludes any slot that overlaps an existing booking (regression test — this was silently broken)', () => {
    const slots = generateSlots({
      ...baseArgs,
      booked: [{ start_time: '2026-07-13T09:45:00.000Z', end_time: '2026-07-13T10:30:00.000Z' }],
    });
    expect(slots).not.toContain('2026-07-13T09:45:00.000Z');
    // Neighboring slots are untouched since they don't overlap
    expect(slots).toContain('2026-07-13T09:00:00.000Z');
    expect(slots).toContain('2026-07-13T10:30:00.000Z');
  });

  it('a booking partway through a slot still excludes that slot', () => {
    // Booking runs 10:00–10:15, which falls inside the 09:45–10:30 slot
    const slots = generateSlots({
      ...baseArgs,
      booked: [{ start_time: '2026-07-13T10:00:00.000Z', end_time: '2026-07-13T10:15:00.000Z' }],
    });
    expect(slots).not.toContain('2026-07-13T09:45:00.000Z');
  });

  it('applies buffer_minutes on both sides of an existing booking', () => {
    const slots = generateSlots({
      ...baseArgs,
      bufferMinutes: 30,
      booked: [{ start_time: '2026-07-13T10:30:00.000Z', end_time: '2026-07-13T11:15:00.000Z' }],
    });
    // With a 30-minute buffer, the booking effectively blocks 10:00–11:45,
    // so both neighboring slots should also be excluded, not just the exact match.
    expect(slots).not.toContain('2026-07-13T09:45:00.000Z'); // ends 10:30, within buffer of booking start
    expect(slots).not.toContain('2026-07-13T10:30:00.000Z');
    expect(slots).not.toContain('2026-07-13T11:15:00.000Z'); // starts within buffer of booking end
  });

  it('returns an empty array when there are no working-hours windows', () => {
    expect(generateSlots({ ...baseArgs, hours: [] })).toEqual([]);
  });

  it('handles multiple windows in the same day (e.g. a lunch break split)', () => {
    const slots = generateSlots({
      ...baseArgs,
      hours: [
        { start_time: '09:00', end_time: '12:00' },
        { start_time: '13:00', end_time: '17:00' },
      ],
    });
    expect(slots).not.toContain('2026-07-13T12:00:00.000Z');
    expect(slots.every((s) => new Date(s).getUTCHours() < 12 || new Date(s).getUTCHours() >= 13)).toBe(
      true
    );
  });
});
