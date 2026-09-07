// Server-only. Replaces lib/paystack.ts entirely (not run alongside it -
// see supabase/schema.sql's "Payments (Flutterwave)" section for why).
// Unlike the old Paystack model, no business ever supplies their own
// secret key here - every call in this file authenticates as Vanova's
// own Flutterwave account (FLUTTERWAVE_SECRET_KEY, the same credential
// already used for subscription billing in
// app/api/billing/checkout+cancel/route.ts). A business only ever gives
// up a bank account number and bank; Vanova creates a Subaccount on
// their behalf and every deposit is a Split Payment into it - the
// business never logs into Flutterwave or verifies anything themselves.

const FLW_BASE = 'https://api.flutterwave.com/v3';

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Vanova keeps 0% by deliberate product decision, not a placeholder left
// at zero by accident - subscription revenue is the business model for
// now, deposits are the business's own money passing through. Change
// this one value (not the call sites) if that ever changes; a subaccount
// already created keeps whatever split it was created with - Flutterwave
// doesn't retroactively change one without an explicit update call, so a
// rate change here only affects subaccounts created after it.
export const PLATFORM_COMMISSION_PCT = 0;

// Confirms an account number actually belongs to a real account at that
// bank, and returns the real name on file - shown back to the owner
// before anything is saved, same reason a bank-transfer app shows you
// who you're actually about to pay rather than trusting a typed number
// blind. Also doubles as proof the account number/bank combination is
// even valid before wasting a createSubaccount call on a typo.
export async function resolveBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ accountNumber: string; accountName: string } | null> {
  const res = await fetch(`${FLW_BASE}/accounts/resolve`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !data.data?.account_name) return null;

  return { accountNumber: data.data.account_number, accountName: data.data.account_name };
}

// The full list of Nigeria-only for now - matches the rest of the app's
// current NGN-only assumption (see schema.sql's currency column comment
// on the plan for retrofitting this later). Used to populate the bank
// picker in Settings so an owner selects a real bank rather than typing
// a code they'd have no way to know.
export async function listNigerianBanks(): Promise<{ code: string; name: string }[] | null> {
  const res = await fetch(`${FLW_BASE}/banks/NG`, { headers: authHeaders() }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !Array.isArray(data.data)) return null;

  return data.data.map((b: { code: string; name: string }) => ({ code: b.code, name: b.name }));
}

// Registers a business's bank account as a Flutterwave Subaccount under
// Vanova's own account - a one-time setup step; every deposit afterward
// just references the returned id (see initializeSplitTransaction).
// business_email/mobile are required by Flutterwave's own API even
// though nothing here reads them back - Flutterwave uses them for their
// own subaccount correspondence, not something this app displays.
export async function createSubaccount(params: {
  accountNumber: string;
  bankCode: string;
  businessName: string;
  businessEmail: string;
  businessMobile: string;
}): Promise<{ subaccountId: string } | null> {
  const res = await fetch(`${FLW_BASE}/subaccounts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      account_bank: params.bankCode,
      account_number: params.accountNumber,
      business_name: params.businessName,
      business_email: params.businessEmail,
      business_mobile: params.businessMobile,
      country: 'NG',
      split_type: 'percentage',
      split_value: PLATFORM_COMMISSION_PCT / 100,
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  // subaccount_id (a string like "RS_...") is what a transaction's
  // subaccounts[].id needs - data.id is Flutterwave's own internal
  // numeric row id, a different value, not usable for splits.
  if (data?.status !== 'success' || !data.data?.subaccount_id) return null;

  return { subaccountId: data.data.subaccount_id };
}

// Hosted checkout link, split to the business's subaccount at whatever
// commission rate it was created with. Mirrors lib/paystack.ts's
// initializePaystackTransaction (a chat conversation has nowhere to host
// a popup, so this happens on Flutterwave's own page and comes back
// asynchronously - via the webhook, or a manual verifyTransaction call
// like whatsappTools.ts's confirmPayment already does for the customer
// who says "I've paid").
export async function initializeSplitTransaction(params: {
  subaccountId: string;
  email: string;
  amountNaira: number;
  txRef: string;
  bookingId: string;
  redirectUrl?: string;
}): Promise<{ checkoutUrl: string } | null> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: String(params.amountNaira),
      currency: 'NGN',
      redirect_url: params.redirectUrl,
      customer: { email: params.email },
      subaccounts: [{ id: params.subaccountId }],
      meta: { booking_id: params.bookingId },
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !data.data?.link) return null;

  return { checkoutUrl: data.data.link };
}

// Independently confirms a transaction actually succeeded and for how
// much - never trust a client-reported reference/amount, same reasoning
// as the old verifyPaystackTransaction. Flutterwave amounts are already
// in plain Naira (unlike Paystack's kobo) - callers compare against a
// plain naira figure, no x100/÷100 anywhere in this file.
export async function verifyTransaction(
  txRef: string
): Promise<{ status: string; amountNaira: number; currency: string } | null> {
  const res = await fetch(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
    headers: authHeaders(),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !data.data) return null;

  return { status: data.data.status, amountNaira: data.data.amount, currency: data.data.currency };
}
