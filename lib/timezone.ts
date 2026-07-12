// Converts a business's local wall-clock time (e.g. "9:00 AM in
// Africa/Lagos") into the correct UTC instant, regardless of what timezone
// the server process happens to be running in. Without this, availability
// was silently computed using the server's local clock — correct on a
// laptop, wrong the moment it's deployed somewhere else.
//
// Standard technique (no extra dependency needed — Node's built-in Intl
// has a full timezone database): make a guess assuming the wall-clock time
// IS utc, see what that guess actually renders as in the target timezone,
// and shift by the difference.
export function zonedTimeToUtc(dateISO: string, timeHHMM: string, timeZone: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  const [hour, minute] = timeHHMM.split(':').map(Number);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(utcGuess).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const renderedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === '24' ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  const offset = utcGuess.getTime() - renderedAsUtc;
  return new Date(utcGuess.getTime() + offset);
}

// "Today" as a YYYY-MM-DD calendar date in the business's timezone, not
// the server's. Matters right at the day boundary — a business in Lagos
// shouldn't have "today" flip over at server-local midnight if the server
// is running in a different timezone.
export function todayInTimezone(timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(new Date()); // en-CA formats as YYYY-MM-DD
}

// Day of week (0 = Sunday … 6 = Saturday) for a plain calendar date,
// independent of any timezone — this is just "which weekday is 2026-07-15",
// not tied to a specific instant, so it must never go through a
// server-local Date object.
export function dayOfWeekForDate(dateISO: string): number {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Whole calendar days between two YYYY-MM-DD dates in the business's
// timezone (used for the max_advance_days check).
export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}
