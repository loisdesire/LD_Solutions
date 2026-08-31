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
// BookingForm, the booking API routes, DashboardPreview.tsx's marketing
// mockup, and both marketing pages).
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

export function formatMoney(amount: number | null | undefined, currency: string = 'NGN'): string {
  if (amount == null) return '-';
  try {
    const parts = new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      // Whole units only, matching the existing site-wide convention
      // (no kobo/cents shown) - not a currency-specific decimals rule,
      // just what every current display already does.
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(amount);
    // Real bug this fixes: with no space between them, "₦" sitting flush
    // against the first digit - combined with the negative letter-spacing
    // every .font-display price runs under - let the Naira sign's own
    // horizontal strokes visually bleed into the number, reading as the
    // whole amount struck through rather than a currency symbol next to
    // one. Only the symbol needs the gap; grouping/decimal separators
    // stay exactly as Intl produces them.
    return parts.map((p) => (p.type === 'currency' ? p.value + SYMBOL_GAP : p.value)).join('');
  } catch {
    // An unrecognized currency code shouldn't crash a page - fall back to
    // a plain pinned-locale number rather than the amount vanishing.
    return new Intl.NumberFormat('en-US').format(amount);
  }
}
