// Prep for international payments (Stripe, for businesses Paystack can't
// onboard - see businesses.currency in supabase/schema.sql). Every one of
// the ~18 sites that currently hand-format `₦${amount.toLocaleString()}`
// assumes Naira and the visitor's own browser locale - the same amount
// literally reads as "₦12.000" for a de-DE visitor and "₦12,000" for
// everyone else, since bare `toLocaleString()` follows *their* locale, not
// a fixed one. This is the replacement: one function, a currency actually
// read from the business, and a pinned locale per currency so the same
// number reads identically no matter who's looking at it.
//
// Retrofit plan, not done yet: this file only adds the capability - the
// 18 existing hardcoded call sites (grep `₦` across app/ and components/)
// still need to switch to this one at a time, threading `business.currency`
// down to each. Left as follow-up rather than a rushed mechanical sweep
// here, since several of those sites (BillingManager, ServicesManager,
// AdminDashboardBody) are exactly the kind of money-display code that
// deserves a real look per file, not a find-and-replace.
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'en-IE',
  GHS: 'en-GH',
  KES: 'en-KE',
  ZAR: 'en-ZA',
};

export function formatMoney(amount: number | null | undefined, currency: string = 'NGN'): string {
  if (amount == null) return '-';
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-US', {
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
