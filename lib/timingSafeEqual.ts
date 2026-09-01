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
  if (a == null || b == null) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
