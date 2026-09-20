import { describe, expect, it } from 'vitest';
import { googleCalendarUrl } from './googleCalendar';

// A plain https link, not a data:-URI .ics download - deliberately, since
// data:-URI downloads are blocked in many in-app browsers (Instagram,
// WhatsApp), exactly where a lot of these bookings happen. Worth checking
// the actual URL shape: Google's "render" template expects UTC dates in
// its own compact format (no dashes/colons, no milliseconds), and the end
// time has to be genuinely derived from start + duration, not restated.
describe('googleCalendarUrl', () => {
  it('builds a calendar.google.com render URL with the title and details', () => {
    const url = googleCalendarUrl({ title: 'Haircut at Glow Salon', startISO: '2026-06-01T09:00:00.000Z', minutes: 30, details: 'See you soon!' });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('calendar.google.com');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('Haircut at Glow Salon');
    expect(parsed.searchParams.get('details')).toBe('See you soon!');
  });

  it('formats both dates in Google’s compact UTC form (no dashes, colons, or milliseconds)', () => {
    const url = googleCalendarUrl({ title: 'x', startISO: '2026-06-01T09:00:00.000Z', minutes: 30, details: '' });
    const dates = new URL(url).searchParams.get('dates');
    expect(dates).toBe('20260601T090000Z/20260601T093000Z');
  });

  it('derives the end time from start + minutes, correctly crossing an hour boundary', () => {
    const url = googleCalendarUrl({ title: 'x', startISO: '2026-06-01T09:45:00.000Z', minutes: 30, details: '' });
    const dates = new URL(url).searchParams.get('dates');
    expect(dates).toBe('20260601T094500Z/20260601T101500Z');
  });
});
