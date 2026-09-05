// Prep for international payments (Stripe, for businesses Paystack can't
// onboard - see businesses.currency in supabase/schema.sql). Also fixes a
// real bug the ~18 old hand-formatted `₦${amount.toLocaleString()}` sites
// all had: bare `toLocaleString()` follows the *visitor's* browser locale,
// not a fixed one, so the same amount literally read as "₦12.000" for a
// de-DE visitor and "₦12,000" for everyone else. One function, a currency
// actually read from the business, and a pinned locale per currency so the
// same number reads identically no matter who's looking at it.
//
// Retrofit done: every real call site now goes through this (BillingManager,
// ServicesManager, ProductsManager, CustomersManager, AdminDashboardBody,
// BookingForm, the booking API routes, and both marketing pages).
// DashboardPreview.tsx (a marketing-page mockup this list used to name) no
// longer exists in the codebase - removed at some point after this comment
// was written; not replacing it with anything, just correcting the record.
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'en-IE',
  GHS: 'en-GH',
  KES: 'en-KE',
  ZAR: 'en-ZA',
};

// A narrow no-break space, not a regular one - visually just a hair of
// breathing room, but it can't ever wrap the symbol away from its number.
const SYMBOL_GAP = ' ';

// Symbols this codebase constructs by hand rather than trusting Intl's
// `style: 'currency'` to insert one - see the comment inside formatMoney
// for why. Only NGN is actually live; every other currency in
// CURRENCY_LOCALE still goes through Intl below since international
// payments aren't shipped yet (see the international-payments project
// note) and there's no live bug report for any of them.
const CURRENCY_SYMBOL: Partial<Record<string, string>> = {
  NGN: '₦',
};

export function formatMoney(amount: number | null | undefined, currency: string = 'NGN'): string {
  if (amount == null) return '-';
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US';
  const symbol = CURRENCY_SYMBOL[currency];
  if (symbol) {
    // A prior fix here assumed the reported "price looks struck through"
    // bug was the Naira glyph's own strokes visually bleeding into the
    // following digit under .font-display's negative letter-spacing, and
    // inserted a space between the symbol and the number. That shipped,
    // live, and the bug still recurred - including on plain body-text
    // prices that were never under that letter-spacing to begin with,
    // which rules that theory out. The real uncertainty `style:
    // 'currency'` carries is what the visitor's OWN browser's Intl/ICU
    // data actually produces for 'en-NG'/'NGN' - this runs client-side in
    // BookingForm and other 'use client' components, not on this
    // codebase's dev machine, so there was never a way to verify from
    // here what Android Chrome specifically inserts around the symbol.
    // Building the string by hand removes that uncertainty rather than
    // theorizing about it again: this exact "₦" (the single, verified-
    // clean U+20A6 codepoint, nothing else), a plain digit-grouped
    // number, nothing left for Intl to choose on its own.
    const digits = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return `${symbol}${SYMBOL_GAP}${digits}`;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // Whole units only, matching the existing site-wide convention
      // (no kobo/cents shown) - not a currency-specific decimals rule,
      // just what every current display already does.
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // An unrecognized currency code shouldn't crash a page - fall back to
    // a plain pinned-locale number rather than the amount vanishing.
    return new Intl.NumberFormat('en-US').format(amount);
  }
}
