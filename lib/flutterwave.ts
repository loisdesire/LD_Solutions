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

// The two countries this Flutterwave account is actually approved for.
// Drives which local bank list/branch-code rules apply and what a
// business's own payout currency is - see businesses.country in
// supabase/schema.sql.
export const COUNTRY_CURRENCY: Record<string, string> = {
  NG: 'NGN',
  GH: 'GHS',
};

// Currencies a customer can optionally pay in when a business has opted
// into accept_foreign_currency, regardless of which of the two countries
// above the business itself is based in. Sourced from what Flutterwave's
// own dashboard shows as provisioned currency balances on this account
// (confirmed live, not assumed) - not exhaustive of everything Flutterwave
// supports, just what's actually usable today.
export const FOREIGN_CURRENCIES = ['USD', 'KES', 'UGX', 'TZS', 'ZAR'] as const;
export type ForeignCurrency = (typeof FOREIGN_CURRENCIES)[number];

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

// Was Nigeria-only (listNigerianBanks); generalized to take a country now
// that Ghana is a second real local market. Used to populate the bank
// picker in Settings so an owner selects a real bank rather than typing
// a code they'd have no way to know. Every existing call site passes
// 'NG' explicitly, so behavior for Nigeria is unchanged. Returns both
// `code` (what account resolution/subaccount creation actually take) and
// `id` (Flutterwave's own internal numeric id, a different value, needed
// separately by getBankBranches below for Ghana's branch picker).
export async function listBanksForCountry(
  country: string
): Promise<{ id: string; code: string; name: string }[] | null> {
  const res = await fetch(`${FLW_BASE}/banks/${country}`, { headers: authHeaders() }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !Array.isArray(data.data)) return null;

  return data.data.map((b: { id: number | string; code: string; name: string }) => ({
    id: String(b.id),
    code: b.code,
    name: b.name,
  }));
}

// Ghana/Tanzania/Rwanda/Uganda subaccounts need a branch code alongside
// the bank + account number (Flutterwave's own requirement, not
// something Nigeria uses at all) - this looks up the real branch list for
// a given bank so Settings can offer a picker instead of asking an owner
// to type a code they'd have no way to know. bankId is the numeric id
// from listBanksForCountry's own underlying data (not the bank "code"
// field used elsewhere) - Flutterwave's branches endpoint keys on it
// specifically, confirmed against their docs, not assumed.
export async function getBankBranches(bankId: string): Promise<{ code: string; name: string }[] | null> {
  const res = await fetch(`${FLW_BASE}/banks/${bankId}/branches`, { headers: authHeaders() }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !Array.isArray(data.data)) return null;

  return data.data.map((b: { branch_code: string; branch_name: string }) => ({ code: b.branch_code, name: b.branch_name }));
}

// Registers a business's bank account as a Flutterwave Subaccount under
// Vanova's own account - a one-time setup step; every deposit afterward
// just references the returned id (see initializeSplitTransaction).
// business_email/mobile are required by Flutterwave's own API even
// though nothing here reads them back - Flutterwave uses them for their
// own subaccount correspondence, not something this app displays.
// country/currency were hardcoded to 'NG'/(implicit NGN) before Ghana
// existed; branchCode is only ever passed for Ghana/Tanzania/Rwanda/
// Uganda accounts, and only appears in the request at all when present -
// Flutterwave's documented shape for it is a `bank_branch` field inside a
// `meta` array, not a top-level field.
export async function createSubaccount(params: {
  accountNumber: string;
  bankCode: string;
  businessName: string;
  businessEmail: string;
  businessMobile: string;
  country: string;
  currency: string;
  branchCode?: string;
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
      country: params.country,
      currency: params.currency,
      split_type: 'percentage',
      split_value: PLATFORM_COMMISSION_PCT / 100,
      ...(params.branchCode ? { meta: [{ bank_branch: params.branchCode }] } : {}),
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

// Hosted checkout link. When subaccountId is given, it splits straight to
// the business's subaccount at whatever commission rate it was created
// with - the same-currency (NGN/GHS) path. subaccountId is optional now:
// a foreign-currency payment (customer paying in USD etc., see
// FOREIGN_CURRENCIES) can't split to a differently-denominated subaccount
// at all - Flutterwave settles that into a currency-matched balance on
// Vanova's own account instead, and getting the money to the business
// afterward is a separate, explicit createPayoutTransfer call. Omitting
// `subaccounts` entirely (not passing an empty array) is what triggers
// that behavior - confirmed against Flutterwave's own request shape, not
// assumed. Mirrors lib/paystack.ts's initializePaystackTransaction (a
// chat conversation has nowhere to host a popup, so this happens on
// Flutterwave's own page and comes back asynchronously - via the
// webhook, or a manual verifyTransaction call like whatsappTools.ts's
// confirmPayment already does for the customer who says "I've paid").
export async function initializeSplitTransaction(params: {
  subaccountId?: string;
  email: string;
  amount: number;
  currency: string;
  txRef: string;
  bookingId: string;
  redirectUrl?: string;
}): Promise<{ checkoutUrl: string } | null> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: String(params.amount),
      currency: params.currency,
      redirect_url: params.redirectUrl,
      customer: { email: params.email },
      ...(params.subaccountId ? { subaccounts: [{ id: params.subaccountId }] } : {}),
      meta: { booking_id: params.bookingId },
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !data.data?.link) return null;

  return { checkoutUrl: data.data.link };
}

// Independently confirms a transaction actually succeeded, for how much,
// and in what currency - never trust a client-reported reference/amount,
// same reasoning as the old verifyPaystackTransaction. Flutterwave
// amounts are already in plain units (unlike Paystack's kobo), no
// x100/÷100 anywhere in this file. Renamed from amountNaira to amount now
// that a transaction genuinely isn't always Naira - every caller must
// check `currency` against what it actually expected rather than
// assuming NGN, which none of them did before Ghana/foreign-currency
// payments existed.
export async function verifyTransaction(
  txRef: string
): Promise<{ status: string; amount: number; currency: string } | null> {
  const res = await fetch(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
    headers: authHeaders(),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !data.data) return null;

  return { status: data.data.status, amount: data.data.amount, currency: data.data.currency };
}

// Given a business's local price, returns what a customer should pay in
// a foreign currency to net that exact local amount - used both to show
// a real quote before charging and, separately, to sanity-check a
// foreign payment's amount at verify-time (see app/api/bookings/route.ts).
//
// Hits Flutterwave's transfer-rates endpoint, GET /transfers/rates. Their
// own documented example (rate 0.000694329, "NGN 1440.24 converting to
// USD 1") makes the direction explicit: `amount` is the DESTINATION-side
// quantity, and `source.amount` in the response is what's computed as
// needed to produce it - not "convert this source amount into
// destination", the reverse of what the param names might suggest at a
// glance. So to answer "what's localAmount in foreignCurrency", the local
// side has to be passed as destination_currency/amount and the foreign
// side as source_currency - reading data.source.amount back out is the
// actual foreign-currency figure. Confirmed against Flutterwave's docs
// this session, never exercised against the live API from here, so the
// sanity bounds below are a real safety net, not decoration: if the
// returned amount is wildly outside a plausible range, treat it as a
// failed lookup rather than trust a possibly-misread response shape.
export async function getConvertedAmount(
  localAmount: number,
  localCurrency: string,
  foreignCurrency: string
): Promise<{ amount: number; rate: number } | null> {
  const url = `${FLW_BASE}/transfers/rates?amount=${localAmount}&destination_currency=${localCurrency}&source_currency=${foreignCurrency}`;
  const res = await fetch(url, { headers: authHeaders() }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  const converted = data?.data?.source?.amount;
  const rate = data?.data?.rate;
  if (data?.status !== 'success' || typeof converted !== 'number' || typeof rate !== 'number') return null;

  // A real currency conversion is never zero, negative, or off by
  // several orders of magnitude from a naive rate=1 conversion - catches
  // a misread response shape (e.g. reading the wrong nested field) rather
  // than silently quoting or charging something absurd.
  if (converted <= 0 || converted > localAmount * 1_000_000 || converted < localAmount / 1_000_000) return null;

  return { amount: converted, rate };
}

// Pushes money out of Vanova's own Flutterwave balance to a business's
// linked bank account, converting currency in the process via
// debit_currency - the mechanism a foreign-currency payment needs to
// actually reach a business, since it can't auto-split like a
// same-currency deposit does (see initializeSplitTransaction's own
// comment). amount/currency here are the DESTINATION side (what the
// business actually receives, in their own local currency) -
// debitCurrency is the source balance Flutterwave draws down and
// converts from. Confirmed real field names against Flutterwave's docs
// this session (account_bank, account_number, amount, currency,
// debit_currency, narration, reference) - never exercised against the
// live API from here.
export async function createPayoutTransfer(params: {
  accountNumber: string;
  bankCode: string;
  amount: number;
  currency: string;
  debitCurrency: string;
  narration: string;
  reference: string;
}): Promise<{ transferId: string; status: string } | null> {
  const res = await fetch(`${FLW_BASE}/transfers`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      account_bank: params.bankCode,
      account_number: params.accountNumber,
      amount: params.amount,
      currency: params.currency,
      debit_currency: params.debitCurrency,
      narration: params.narration,
      reference: params.reference,
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success' || !data.data?.id) return null;

  return { transferId: String(data.data.id), status: data.data.status };
}
