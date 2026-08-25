// Google Calendar rather than an .ics download: data:-URI downloads are
// blocked in many in-app browsers (Instagram, WhatsApp) which is exactly
// where a lot of these bookings happen. A plain https link degrades to
// "opens a web page" at worst, instead of silently doing nothing.
//
// Extracted out of BookingForm - the account hub's booking cards need the
// exact same link for a booking made any time in the past, not just the
// one just confirmed.
export function googleCalendarUrl(opts: {
  title: string;
  startISO: string;
  minutes: number;
  details: string;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(opts.startISO);
  const end = new Date(start.getTime() + opts.minutes * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: opts.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
