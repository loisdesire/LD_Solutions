import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

// This exact function has already shipped, live, at least twice for the
// same class of bug - a Naira amount rendering with the ₦ glyph reading
// as struck through / bleeding into the following digit (see the
// function's own comment on why it now builds the NGN string by hand
// instead of trusting Intl's style: 'currency'). Zero tests existed
// despite that track record and despite formatMoney being the one call
// every price display in the app (billing, services, products,
// bookings, both marketing pages) now goes through.
describe('formatMoney', () => {
  it('builds the Naira string by hand: symbol, one narrow no-break space, then a plain comma-grouped number', () => {
    expect(formatMoney(15000, 'NGN')).toBe('₦ 15,000');
  });

  it('defaults to NGN when no currency is given', () => {
    expect(formatMoney(15000)).toBe(formatMoney(15000, 'NGN'));
  });

  it('shows whole units only - no kobo/cents, matching the site-wide convention', () => {
    expect(formatMoney(15000.75, 'NGN')).toBe('₦ 15,001');
  });

  it('never invents an amount for null or undefined - a missing price is "-", not "₦0" or "NaN"', () => {
    expect(formatMoney(null, 'NGN')).toBe('-');
    expect(formatMoney(undefined, 'NGN')).toBe('-');
  });

  it('formats zero as a real, correct zero - not treated the same as a missing amount', () => {
    expect(formatMoney(0, 'NGN')).toBe('₦ 0');
  });

  it('routes every non-NGN currency through Intl rather than the hand-built path - only NGN has a documented glyph bug', () => {
    const usd = formatMoney(1500, 'USD');
    expect(usd).not.toContain('₦');
    expect(usd).toMatch(/\$/);
    expect(usd).toMatch(/1,500/);
  });

  it('formats every currency this app actually provisions (NGN, GHS, and the foreign-currency-deposit set) without throwing', () => {
    for (const currency of ['NGN', 'GHS', 'USD', 'KES', 'UGX', 'TZS', 'ZAR']) {
      expect(() => formatMoney(1000, currency)).not.toThrow();
      expect(formatMoney(1000, currency)).not.toBe('');
    }
  });

  it('falls back to a plain pinned-locale number, not a crash, for a currency code Intl does not recognize', () => {
    expect(() => formatMoney(1000, 'NOT_A_REAL_CODE')).not.toThrow();
    expect(formatMoney(1000, 'NOT_A_REAL_CODE')).toBe('1,000');
  });
});
