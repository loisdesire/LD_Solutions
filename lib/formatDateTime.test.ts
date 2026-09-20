import { describe, expect, it } from 'vitest';
import { formatLocalDateTime, formatLocalTime, to24Hour } from './formatDateTime';

// The single definition every AI agent's tools now format times through
// (was three near-identical copies able to drift from each other) -
// specifically so the model never has to do UTC-to-local mental math
// itself, "exactly the kind of arithmetic LLMs get wrong silently" per
// the file's own comment. If this formats a wrong local time, every
// agent across every channel tells a customer the wrong appointment
// time. Zero tests existed for the one function standing between "an AI
// booking receptionist" and "an AI booking receptionist that sometimes
// tells you the wrong hour". Fixtures below are real values computed by
// running these exact calls in Node, not hand-derived by eye.
describe('formatLocalDateTime', () => {
  it('converts a UTC instant to the target timezone’s real local weekday/date/time', () => {
    expect(formatLocalDateTime('2026-03-15T14:30:00.000Z', 'America/New_York')).toBe('Sun, Mar 15, 10:30 AM');
  });
});

describe('formatLocalTime', () => {
  it('converts a UTC instant to the target timezone’s real local time only', () => {
    expect(formatLocalTime('2026-03-15T14:30:00.000Z', 'Africa/Lagos')).toBe('3:30 PM');
  });
});

describe('to24Hour', () => {
  it('renders in 24-hour time, not 12-hour', () => {
    expect(to24Hour('2026-03-15T14:30:00.000Z', 'Africa/Lagos')).toBe('15:30');
  });

  it('renders midnight-crossing correctly across the date boundary, not as "24:30"', () => {
    expect(to24Hour('2026-01-01T23:30:00.000Z', 'Africa/Lagos')).toBe('00:30');
  });
});
