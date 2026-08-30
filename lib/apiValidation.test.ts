import { describe, expect, it } from 'vitest';
import {
  cleanEmail,
  cleanIsoInstant,
  cleanPhone,
  cleanRequiredText,
  isCalendarDate,
  isUuid,
  cleanSlug,
  isAcceptablePassword,
} from './apiValidation';

describe('public API validation', () => {
  it('accepts UUIDs and rejects malformed identifiers', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('rejects impossible and loosely formatted calendar dates', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-2-3')).toBe(false);
  });

  it('trims bounded required text', () => {
    expect(cleanRequiredText('  Amaka  ', 20)).toBe('Amaka');
    expect(cleanRequiredText('   ', 20)).toBeNull();
    expect(cleanRequiredText('too long', 3)).toBeNull();
  });

  it('normalizes valid email and rejects invalid email', () => {
    expect(cleanEmail('  PERSON@Example.COM ', true)).toBe('person@example.com');
    expect(cleanEmail('not-an-email', true)).toBeUndefined();
  });

  it('accepts common phone punctuation but rejects letters and implausible lengths', () => {
    expect(cleanPhone('+234 (801) 234-5678', true)).toBe('+234 (801) 234-5678');
    expect(cleanPhone('call-me', true)).toBeUndefined();
    expect(cleanPhone('123', true)).toBeUndefined();
  });

  it('normalizes valid instants and rejects invalid dates', () => {
    expect(cleanIsoInstant('2026-08-30T14:00:00+01:00')).toBe('2026-08-30T13:00:00.000Z');
    expect(cleanIsoInstant('tomorrow afternoon')).toBeNull();
  });

  it('accepts canonical slugs and rejects unsafe path-like values', () => {
    expect(cleanSlug(' Glow-Salon ')).toBe('glow-salon');
    expect(cleanSlug('../admin')).toBeNull();
    expect(cleanSlug('double--dash')).toBeNull();
  });

  it('bounds passwords without changing their contents', () => {
    expect(isAcceptablePassword('eight888')).toBe(true);
    expect(isAcceptablePassword('short')).toBe(false);
    expect(isAcceptablePassword('x'.repeat(129))).toBe(false);
  });
});
