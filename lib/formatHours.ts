const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type AvailabilityRow = { day_of_week: number; start_time: string; end_time: string };

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === '00' ? `${h12} ${period}` : `${h12}:${mStr} ${period}`;
}

// Condenses "Mon 9-5, Tue 9-5, Wed 9-5, Fri 10-6" into "Mon-Wed · 9 AM-5 PM,
// Fri · 10 AM-6 PM" - a customer landing on the booking page wants to know
// at a glance whether the business is open, not read a 7-row table.
export function summarizeHours(rows: AvailabilityRow[]): string | null {
  if (rows.length === 0) return null;

  const byHours = new Map<string, number[]>();
  for (const r of rows) {
    const key = `${r.start_time}-${r.end_time}`;
    if (!byHours.has(key)) byHours.set(key, []);
    byHours.get(key)!.push(r.day_of_week);
  }

  const segments: { days: number[]; start: string; end: string }[] = [];
  for (const [key, days] of byHours) {
    const [start, end] = key.split('-');
    segments.push({ days: [...days].sort((a, b) => a - b), start, end });
  }

  const parts = segments.map(({ days, start, end }) => {
    const ranges: string[] = [];
    let rangeStart = days[0];
    let prev = days[0];
    for (let i = 1; i <= days.length; i++) {
      const d = days[i];
      if (d === prev + 1) {
        prev = d;
        continue;
      }
      ranges.push(
        rangeStart === prev ? DAY_ABBR[rangeStart] : `${DAY_ABBR[rangeStart]}-${DAY_ABBR[prev]}`
      );
      rangeStart = d;
      prev = d;
    }
    return `${ranges.join(', ')} · ${formatTime(start)}-${formatTime(end)}`;
  });

  return parts.join(', ');
}
