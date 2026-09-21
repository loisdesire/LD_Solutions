import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { resolveBankAccount, createSubaccount, getBankBranches, COUNTRY_CURRENCY } from '@/lib/flutterwave';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/settings/flutterwave/link-account - replaces
// /api/settings/paystack/validate. A meaningfully different job, not just
// a rename: the old route only checked a key pair the owner typed in
// themselves and then saved client-side. This route does the actual
// account setup - resolves the bank account (so a typo surfaces as "check
// the number" instead of a silently misdirected payout), creates the
// Flutterwave Subaccount under Vanova's own account, and only then saves
// anything - never trusting the client to have done any of that. Runs
// entirely server-side because FLUTTERWAVE_SECRET_KEY must never reach
// the browser, same reasoning the old route had for the Paystack secret
// key.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`flutterwave-link:${getClientIp(req)}`, 10, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts, please try again shortly' }, { status: 429 });
  }

  const { slug, bankCode, bankId, accountNumber, confirmAccountNumber, country: rawCountry, branchCode } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id, name', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  const bank = String(bankCode ?? '').trim();
  const account = String(accountNumber ?? '').trim();
  // Only 'NG'/'GH' mean anything (see COUNTRY_CURRENCY) - anything else
  // falls back to Nigeria rather than silently creating a subaccount with
  // an unsupported country/currency pair.
  const country = rawCountry === 'GH' ? 'GH' : 'NG';
  const currency = COUNTRY_CURRENCY[country];
  const branch = String(branchCode ?? '').trim();

  if (!bank) return NextResponse.json({ ok: false, error: 'Pick a bank first.' });
  if (!/^\d{10}$/.test(account)) return NextResponse.json({ ok: false, error: 'Account numbers are 10 digits - check for a typo.' });
  // Ghana-only, re-checked server-side rather than trusting the client's
  // own match - Flutterwave's accounts/resolve endpoint rejects every
  // Ghana bank code on this account (confirmed live, mobile money and
  // real banks alike), so there's no independent "does this look right"
  // check available for Ghana the way Nigeria gets below. Retyping the
  // number is the only typo-catching this path has.
  if (country === 'GH' && account !== String(confirmAccountNumber ?? '').trim()) {
    return NextResponse.json({ ok: false, error: "The account numbers don't match." });
  }

  // Independently re-checks whether this bank actually needs a branch,
  // never trusting the client's own branchCode presence/absence as proof
  // either way - same reasoning as re-resolving the account below rather
  // than trusting a client-reported account name. See getBankBranches'
  // own comment: Ghana's bank list mixes mobile money networks in with
  // real banks, and only Flutterwave's own answer (an empty list vs a
  // real one) says which is which.
  if (country === 'GH') {
    const id = String(bankId ?? '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'Pick a bank first.' });
    const branches = await getBankBranches(id);
    if (branches === null) {
      return NextResponse.json({ ok: false, error: "Couldn't verify this bank's branch requirements. Try again shortly." });
    }
    if (branches.length > 0 && !branch) {
      return NextResponse.json({ ok: false, error: 'Pick your bank branch first.' });
    }
  }

  // Nigeria: resolveBankAccount independently confirms the account name
  // before anything is created, so a typo surfaces as "check the number"
  // instead of a silently misdirected payout. Ghana skips this entirely -
  // see the accountNumber/confirmAccountNumber check above for why - and
  // uses whatever the owner typed, unverified, as-is.
  let accountNumberToUse = account;
  let accountName: string | null = null;
  if (country === 'NG') {
    const resolved = await resolveBankAccount(account, bank);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        error: "Couldn't verify that account - check the account number and bank, then try again.",
      });
    }
    accountNumberToUse = resolved.accountNumber;
    accountName = resolved.accountName;
  }

  const { data: ownerRow } = await supabaseAdmin
    .from('staff')
    .select('email')
    .eq('business_id', business.id)
    .eq('role', 'owner')
    .maybeSingle();

  const sub = await createSubaccount({
    accountNumber: accountNumberToUse,
    bankCode: bank,
    businessName: business.name,
    businessEmail: ownerRow?.email ?? `${slug}@vanovahub.com`,
    country,
    currency,
    branchCode: branch || undefined,
  });

  if (!sub) {
    logError(
      'api/settings/flutterwave/link-account:create-subaccount',
      new Error('Flutterwave subaccount creation failed'),
      { businessId: business.id },
      { critical: true }
    );
    return NextResponse.json({ ok: false, error: "Couldn't set up payouts with Flutterwave. Try again shortly." });
  }

  // Ghana has no real resolved name to store - a masked version of the
  // number itself (never a fabricated person's name) is what the UI shows
  // as "connected", honestly labeled as unverified there, not here.
  const displayName = accountName ?? `Account ending in ${accountNumberToUse.slice(-4)}`;

  const { error } = await supabaseAdmin
    .from('businesses')
    .update({
      flw_subaccount_id: sub.subaccountId,
      flw_bank_code: bank,
      flw_account_number: accountNumberToUse,
      flw_account_name: displayName,
      flw_branch_code: branch || null,
      country,
      currency,
    })
    .eq('id', business.id);

  if (error) {
    logError('api/settings/flutterwave/link-account:save', error, { businessId: business.id });
    return NextResponse.json({ ok: false, error: "Account verified but couldn't save. Try again." });
  }

  return NextResponse.json({ ok: true, accountName: displayName });
}
