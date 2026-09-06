// Converts a business's local wall-clock time (e.g. "9:00 AM in
// Africa/Lagos") into the correct UTC instant, regardless of what timezone
// the server process happens to be running in. Without this, availability
// was silently computed using the server's local clock - correct on a
// laptop, wrong the moment it's deployed somewhere else.
//
// Standard technique (no extra dependency needed - Node's built-in Intl
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
// the server's. Matters right at the day boundary - a business in Lagos
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
// independent of any timezone - this is just "which weekday is 2026-07-15",
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

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Confirmed live as its own distinct bug, separate from the day-name
// resolution upcomingDatesTable below already fixes: the customer-facing
// agent stated "Today is a Monday" on an actual Thursday, for an hours
// lookup that never goes through check_availability (and so never even
// reaches the date table) - it's driven by a plain weekly-hours list
// indexed by weekday, so the model has to independently work out which
// weekday today's bare date string falls on. Same root cause (calendar
// arithmetic with no scaffolding), different code path, so it needed its
// own explicit fix rather than assuming the table alone would cover it.
export function weekdayName(dateISO: string): string {
  return WEEKDAY_NAMES[dayOfWeekForDate(dateISO)];
}

// A ready weekday->date lookup table for the chat agents' system prompts,
// computed here in code rather than left for the model to work out for
// itself turn by turn. Confirmed live: with only a bare "today's date is
// X" string to go on, resolving something like "next Wednesday" is exact
// multi-step calendar arithmetic the model got wrong from its very first
// answer in a real conversation, then drifted differently again on every
// later turn (offering "Wednesday, September 7" in one message and
// "Wednesday, September 6" in the next) - the same class of problem as
// the duration_minutes day/week-to-minutes bug, and the same fix: remove
// the arithmetic from the model's own head entirely by handing it the
// already-correct answer instead of trusting it to recompute one.
export function upcomingDatesTable(timeZone: string, days: number = 14): string {
  const [y, m, d] = todayInTimezone(timeZone).split('-').map(Number);
  const startUtc = Date.UTC(y, m - 1, d);

  const lines: string[] = [];
  for (let i = 0; i < days; i++) {
    const dayUtc = new Date(startUtc + i * 86400000);
    const weekday = WEEKDAY_NAMES[dayUtc.getUTCDay()];
    const dateISO = `${dayUtc.getUTCFullYear()}-${String(dayUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(dayUtc.getUTCDate()).padStart(2, '0')}`;
    const label = `${weekday}, ${MONTH_NAMES[dayUtc.getUTCMonth()]} ${dayUtc.getUTCDate()}`;
    lines.push(`${label} = ${dateISO}${i === 0 ? ' (today)' : i === 1 ? ' (tomorrow)' : ''}`);
  }
  return lines.join('\n');
}

// The "here's what today actually is" system-prompt fragment every agent
// that resolves a relative date needs - was hand-duplicated (with the
// wording slowly drifting) across whatsappAgent.ts, assistantAgent.ts, and
// onboardingAgent.ts, three separate call sites each computing
// todayInTimezone/upcomingDatesTable themselves and writing their own
// version of the same paragraph. That duplication is exactly what let
// onboardingAgent.ts's copy go missing entirely for a while: it reused
// MANAGE_TOOLS' date-sensitive reminder tool but nobody had to remember to
// also carry over this paragraph, since there was no single place that
// coupled "you have a date-sensitive tool" to "therefore you need this
// text" - confirmed live, the model had no real anchor for "today" at all
// and confidently insisted a real date days out was already in the past.
// One function now: `todayNote` is the clause after the timezone line
// (agent-specific - e.g. what to say if literally asked what day it is),
// `tableNote` introduces the table (agent-specific - e.g. "when the
// customer names a day" vs "if they ask for a reminder"). The date math
// and the table itself are never rewritten by hand again.
export function dateGroundingBlock(timeZone: string, todayNote: string, tableNote: string): string {
  const today = todayInTimezone(timeZone);
  return `Today is ${weekdayName(today)}, ${today} (business timezone: ${timeZone}) - ${todayNote}
${tableNote}
${upcomingDatesTable(timeZone)}`;
}
