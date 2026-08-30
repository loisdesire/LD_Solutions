const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function cleanRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : null;
}

export function cleanOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value == null || value === '') return null;
  return cleanRequiredText(value, maxLength) ?? undefined;
}

export function cleanEmail(value: unknown, required = false): string | null | undefined {
  if (value == null || value === '') return required ? undefined : null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().toLowerCase();
  return cleaned.length <= 254 && EMAIL_RE.test(cleaned) ? cleaned : undefined;
}

export function cleanPhone(value: unknown, required = false): string | null | undefined {
  if (value == null || value === '') return required ? undefined : null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  // International punctuation is accepted, but a phone must contain a
  // plausible number of digits and no letters/control characters.
  const digits = cleaned.replace(/\D/g, '');
  return /^[+\d\s().-]+$/.test(cleaned) && digits.length >= 7 && digits.length <= 15 && cleaned.length <= 32
    ? cleaned
    : undefined;
}

export function cleanIsoInstant(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function cleanSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  return cleaned.length >= 2 && cleaned.length <= 63 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned)
    ? cleaned
    : null;
}

export function isAcceptablePassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}
