import { zonedTimeToUtc } from './timezone';

type Window = { start_time: string; end_time: string };
type Booking = { start_time: string; end_time: string };

// Pure function, no I/O - generates candidate slots across working-hours
// windows in duration-sized steps, converts each to the correct UTC instant
// for the business's timezone, and excludes anything that overlaps an
// existing booking (padded by the buffer on each side). Split out from
// getAvailableSlots so this logic can be unit tested without a database.
//
// staffCapacity defaults to 1, which reproduces the exact old behavior
// (excluded the moment ANY booking overlapped) for a single-staff
// business or any caller that doesn't pass it. A business with N staff
// can have up to N overlapping bookings before a slot actually counts as
// full - see lib/assignStaff.ts for the matching change on the
// booking-creation side (this only decides what's OFFERED as bookable;
// which specific staff member a booking actually lands on is decided
// there, at insert time).
export function generateSlots({
  dateISO,
  timeZone,
  hours,
  durationMinutes,
  bufferMinutes,
  booked,
  staffCapacity = 1,
}: {
  dateISO: string;
  timeZone: string;
  hours: Window[];
  durationMinutes: number;
  bufferMinutes: number;
  booked: Booking[];
  staffCapacity?: number;
}): string[] {
  const slots: string[] = [];

  for (const window of hours) {
    let cursor = zonedTimeToUtc(dateISO, window.start_time.slice(0, 5), timeZone);
    const windowEnd = zonedTimeToUtc(dateISO, window.end_time.slice(0, 5), timeZone);

    while (cursor.getTime() + durationMinutes * 60000 <= windowEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);

      const overlapCount = booked.filter((b) => {
        const bStart = new Date(new Date(b.start_time).getTime() - bufferMinutes * 60000);
        const bEnd = new Date(new Date(b.end_time).getTime() + bufferMinutes * 60000);
        return slotStart < bEnd && slotEnd > bStart;
      }).length;

      if (overlapCount < Math.max(1, staffCapacity)) {
        slots.push(slotStart.toISOString());
      }

      cursor = new Date(cursor.getTime() + durationMinutes * 60000);
    }
  }

  return slots;
}
