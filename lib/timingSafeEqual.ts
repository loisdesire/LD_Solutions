import crypto from 'crypto';

// Small shared helper for the "compare against a secret/token from env"
// pattern that shows up across this app's webhook and cron routes - see
// verifyCronSecret.ts and the Paystack/Flutterwave/Meta webhook routes
// for the fuller version of the reasoning: a plain !== short-circuits on
// the first differing byte, which leaks how many leading characters a
// guess got right through response timing. timingSafeEqual throws
// (rather than returning false) on a length mismatch, so length is
// checked first.
export function timingSafeEqualStrings(a: string | null | undefined, b: string | null | undefined): boolean {
  // Every current call site also separately guards its own `expected`
  // value being non-empty before ever reaching here (an unconfigured
  // secret env var falls back to '' at each of them) - but that guard
  // lives at each call site, not in this shared helper, so a future
  // caller that trusts the name alone would inherit a real bug:
  // crypto.timingSafeEqual on two zero-length buffers returns true
  // (nothing to compare, lengths match), so an unset secret ('') would
  // wrongly "match" a request that also sent an empty signature header.
  // Rejecting empty up front makes this helper safe by default, not
  // just safe everywhere it happens to already be paired with a second
  // check.
  if (a == null || b == null || a === '' || b === '') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
