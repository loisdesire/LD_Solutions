// Client-safe only - no fetch calls, no secret key. PaymentsManager (a
// client component) needs this same check to decide whether to show a
// branch picker at all; lib/flutterwave.ts is explicitly server-only
// (every export in it either holds or reaches for FLUTTERWAVE_SECRET_KEY),
// so this one pure function lives here instead and gets re-exported from
// there for server call sites.

// Ghana's own bank list (from /v3/banks/GH) mixes real banks in with
// mobile money networks (MTN Mobile Money, Vodafone/Telecel Cash,
// AirtelTigo Money) - Flutterwave's branch-code requirement is a bank
// thing, not a mobile money thing, and there is nothing for the branches
// endpoint to return for one of these. Confirmed live: picking a mobile
// money entry and hitting the branches endpoint surfaced as a generic
// "couldn't reach Flutterwave" error instead of correctly skipping the
// step - this lets both the UI and the link-account route skip it
// instead of asking for something that doesn't exist. Matched by name
// since Flutterwave's bank list has no separate machine-readable type
// field to key off of.
export function isMobileMoneyBankName(name: string): boolean {
  return /mobile money|momo|\bcash\b/i.test(name);
}
