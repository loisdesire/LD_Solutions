import { describe, expect, it } from 'vitest';
import { timingSafeEqualStrings } from './timingSafeEqual';

// This is the actual guard on api/webhooks/flutterwave (and every other
// webhook route) - the app previously had exactly this class of bug live
// (a plain !== comparison on that same route, leaking timing info about
// how many leading characters of the real secret an attacker's guess
// got right). Zero tests existed for the shared helper meant to prevent
// that from recurring anywhere else in the app.
describe('timingSafeEqualStrings', () => {
  it('is true for two identical strings', () => {
    expect(timingSafeEqualStrings('a-real-secret-hash', 'a-real-secret-hash')).toBe(true);
  });

  it('is false for two different strings of the same length - the actual case a naive !== also gets right, but must not regress', () => {
    expect(timingSafeEqualStrings('a-real-secret-hash', 'b-real-secret-hash')).toBe(false);
  });

  it('is false, not thrown, for strings of different lengths - crypto.timingSafeEqual itself throws on a length mismatch, this must not leak that outward', () => {
    expect(() => timingSafeEqualStrings('short', 'a-much-longer-string')).not.toThrow();
    expect(timingSafeEqualStrings('short', 'a-much-longer-string')).toBe(false);
  });

  it('is false for a null or undefined value on either side, never treated as equal', () => {
    expect(timingSafeEqualStrings(null, 'a-real-secret-hash')).toBe(false);
    expect(timingSafeEqualStrings('a-real-secret-hash', null)).toBe(false);
    expect(timingSafeEqualStrings(undefined, undefined)).toBe(false);
  });

  it('is false for two empty strings - an unset secret must never compare equal to a missing header', () => {
    expect(timingSafeEqualStrings('', '')).toBe(false);
  });
});
