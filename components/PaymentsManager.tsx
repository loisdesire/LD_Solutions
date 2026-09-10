'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import CheckIcon from './CheckIcon';
import Toggle from './Toggle';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { inputClass, smallInputClass, labelClass, connectedBadgeClass, connectedDotClass } from './formStyles';

// Split out of what used to be SettingsManager - a live payment secret
// used to share one Save button with buffer times and a Zapier webhook.
// Money handling gets its own section, own save action, and own server
// round-trip now, so it's never accidentally bundled with an unrelated
// edit.
//
// Was Paystack keys pasted here directly; now a bank account linked
// through Vanova's own Flutterwave account instead (see
// supabase/schema.sql's "Payments (Flutterwave)" section for why). The
// business never sees or types a Flutterwave key at all - the account
// number and bank are all that's needed, verified and turned into a real
// payout destination by app/api/settings/flutterwave/link-account/
// route.ts, server-side.
export default function PaymentsManager({
  slug,
  businessId,
  initialRequirePayment,
  initialDepositPercentage,
  initialAccountName,
  initialBankCode,
  initialAccountNumber,
  initialCountry,
  initialBranchCode,
  initialAcceptForeignCurrency,
}: {
  slug: string;
  businessId: string;
  initialRequirePayment: boolean;
  initialDepositPercentage: number | null;
  initialAccountName: string | null;
  initialBankCode: string | null;
  initialAccountNumber: string | null;
  initialCountry: string;
  initialBranchCode: string | null;
  initialAcceptForeignCurrency: boolean;
}) {
  const [requirePayment, setRequirePayment] = useState(initialRequirePayment);
  // null/100 both mean "full amount" - one flag (isDeposit) plus a number
  // kept separately means the percentage field doesn't get wiped out just
  // from toggling "Full amount" on and back off again.
  const [isDeposit, setIsDeposit] = useState(initialDepositPercentage != null && initialDepositPercentage < 100);
  const [depositPercentage, setDepositPercentage] = useState(
    initialDepositPercentage != null && initialDepositPercentage < 100 ? initialDepositPercentage : 50
  );

  // 'NG'/'GH' are the only two that mean anything (see COUNTRY_CURRENCY in
  // lib/flutterwave.ts) - a business picks this once, alongside their
  // bank, since it decides both the bank list and whether a branch code
  // is needed at all (Ghana only).
  const [country, setCountry] = useState(initialCountry === 'GH' ? 'GH' : 'NG');
  const [banks, setBanks] = useState<{ id: string; code: string; name: string }[]>([]);
  const [banksError, setBanksError] = useState('');
  const [bankCode, setBankCode] = useState(initialBankCode ?? '');
  // What's actually typed in the bank field - a plain <select> can't be
  // searched by typing, confirmed live as "insane" with 20+ Nigerian
  // banks in an unsorted list. Kept separate from bankCode: this is
  // free-text the user is actively editing/searching with, bankCode is
  // only ever set once it resolves to a real, exact bank match.
  const [bankQuery, setBankQuery] = useState('');
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber ?? '');
  const [businessMobile, setBusinessMobile] = useState('');
  const [branches, setBranches] = useState<{ code: string; name: string }[]>([]);
  const [branchesError, setBranchesError] = useState('');
  const [branchCode, setBranchCode] = useState(initialBranchCode ?? '');
  // Set once a save actually succeeds (this session or a prior one) -
  // separate from bankCode/accountNumber so editing either field without
  // saving doesn't make a previously-linked account look connected under
  // different numbers.
  const [linkedAccountName, setLinkedAccountName] = useState(initialAccountName ?? '');
  const [acceptForeignCurrency, setAcceptForeignCurrency] = useState(initialAcceptForeignCurrency);

  // Live account-name lookup as bank + account number fill in - resolved
  // the moment both are present, not held back until Save is clicked.
  // Read-only preview: applying it for real (creating the Flutterwave
  // subaccount) still only happens on Save, this is purely "does this
  // look right before you commit to it."
  const [resolvedName, setResolvedName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();
  const router = useRouter();

  // Re-fetched whenever the country changes (a Ghana bank list is a
  // different set from Nigeria's), and reset first so a stale NG bank
  // code can't linger selected under a GH label. Loaded on demand rather
  // than on every render - a business that never opens the payments
  // toggle never pays for this request.
  useEffect(() => {
    if (!requirePayment) return;
    setBanks([]);
    setBanksError('');
    fetch(`/api/settings/flutterwave/banks?slug=${encodeURIComponent(slug)}&country=${country}`)
      .then((r) => r.json())
      .then((data) => {
        // Flutterwave returns these in whatever order their own system
        // happens to have them in - not alphabetical, confirmed live.
        // Sorted here once, client-side, rather than trusting the API's
        // own ordering.
        if (Array.isArray(data.banks)) {
          setBanks([...data.banks].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setBanksError(data.error ?? 'Could not load the bank list.');
        }
      })
      .catch(() => setBanksError('Could not load the bank list.'));
  }, [requirePayment, country, slug]);

  // Ghana needs a branch code alongside the bank + account number -
  // fetched once a specific bank is picked (the branch list is per-bank),
  // never for Nigeria at all.
  useEffect(() => {
    if (country !== 'GH' || !bankCode) {
      setBranches([]);
      return;
    }
    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) return;
    setBranches([]);
    setBranchesError('');
    fetch(`/api/settings/flutterwave/branches?slug=${encodeURIComponent(slug)}&bankId=${bank.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.branches)) setBranches(data.branches);
        else setBranchesError(data.error ?? 'Could not load the branch list.');
      })
      .catch(() => setBranchesError('Could not load the branch list.'));
  }, [country, bankCode, banks, slug]);

  // Fills the search field with the already-linked bank's real name once
  // the list loads - otherwise a business editing an existing account
  // would see an empty search box next to "Connected", with no way to
  // tell which bank that connection is actually for.
  useEffect(() => {
    if (!bankCode || bankQuery) return;
    const match = banks.find((b) => b.code === bankCode);
    if (match) setBankQuery(match.name);
  }, [banks, bankCode, bankQuery]);

  const accountConnected = linkedAccountName.trim() !== '';
  // Read inside the debounce effect below via a ref, not the plain
  // boolean directly - that effect's own dependency array can't include
  // accountConnected without re-running (and re-debouncing) every time
  // linkedAccountName changes, which happens mid-edit specifically
  // because the field handlers below clear it on every keystroke.
  const accountConnectedRef = useRef(accountConnected);
  accountConnectedRef.current = accountConnected;

  // Live account-name preview - resolves the moment a real bank and a
  // full 10-digit account number are both present, debounced so it's not
  // firing on every keystroke while the number's still being typed. Pure
  // preview: this never creates anything on Flutterwave's side (that's
  // resolveBankAccount alone, not createSubaccount) - Save is still the
  // only action that actually links the account.
  useEffect(() => {
    setResolveError('');
    if (!bankCode || accountNumber.length !== 10) {
      setResolvedName('');
      return;
    }
    // Already known (either just linked, or loaded from a saved account
    // that hasn't changed) - no need to re-resolve the same pair again.
    if (accountConnectedRef.current && bankCode === initialBankCode && accountNumber === initialAccountNumber) {
      return;
    }
    let cancelled = false;
    setResolving(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/settings/flutterwave/resolve-account?slug=${encodeURIComponent(slug)}&bankCode=${bankCode}&accountNumber=${accountNumber}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.accountName) setResolvedName(data.accountName);
          else {
            setResolvedName('');
            setResolveError(data.error ?? "Couldn't verify that account.");
          }
        })
        .catch(() => {
          if (!cancelled) setResolveError("Couldn't verify that account.");
        })
        .finally(() => {
          if (!cancelled) setResolving(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bankCode, accountNumber, slug, initialBankCode, initialAccountNumber]);

  const dirty =
    !saved &&
    (requirePayment !== initialRequirePayment ||
      bankCode !== (initialBankCode ?? '') ||
      accountNumber !== (initialAccountNumber ?? '') ||
      branchCode !== (initialBranchCode ?? '') ||
      acceptForeignCurrency !== initialAcceptForeignCurrency);
  useUnsavedChangesWarning(dirty);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    // Only actually link an account when there's something new to link -
    // re-verifying and re-creating a subaccount on every save (even one
    // that only touched the deposit percentage) would be wasteful and,
    // worse, would silently create a fresh Flutterwave subaccount each
    // time. Only runs when the account number, bank, or branch actually
    // changed from what's already linked.
    const accountChanged =
      bankCode !== (initialBankCode ?? '') ||
      accountNumber !== (initialAccountNumber ?? '') ||
      branchCode !== (initialBranchCode ?? '');

    if (requirePayment && accountChanged) {
      if (!bankCode || !accountNumber) {
        setSaving(false);
        setError('Pick a bank and enter an account number.');
        return;
      }
      if (country === 'GH' && !branchCode) {
        setSaving(false);
        setError('Pick your bank branch first.');
        return;
      }
      try {
        const res = await fetch('/api/settings/flutterwave/link-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, bankCode, accountNumber, businessMobile, country, branchCode }),
        });
        const check = await res.json();
        if (!res.ok || !check.ok) {
          setSaving(false);
          setError(check.error ?? 'Could not link that account. Nothing was saved.');
          return;
        }
        setLinkedAccountName(check.accountName);
      } catch {
        setSaving(false);
        setError("Couldn't reach the server to link that account. Nothing was saved.");
        return;
      }
    }

    // link-account already saved flw_subaccount_id/flw_bank_code/
    // flw_account_number/flw_account_name/flw_branch_code/country/currency
    // server-side when the account changed - this saves the two settings
    // the client is allowed to write directly (same RLS scope as every
    // other business-owned setting): the require_payment/deposit toggle
    // on booking_rules, and accept_foreign_currency on businesses itself
    // (a separate table, so a separate call - no shared row to update
    // both in one write).
    const [{ error: rulesError }, { error: businessError }] = await Promise.all([
      supabase
        .from('booking_rules')
        .update({
          require_payment: requirePayment,
          deposit_percentage: requirePayment ? (isDeposit ? depositPercentage : 100) : null,
        })
        .eq('business_id', businessId),
      supabase.from('businesses').update({ accept_foreign_currency: acceptForeignCurrency }).eq('id', businessId),
    ]);

    setSaving(false);

    if (rulesError || businessError) {
      setError(friendlyError(rulesError ?? businessError));
      return;
    }
    setSaved(true);
    // require_payment gates whether the public booking page even shows a
    // payment step - server-rendered, same gap as BusinessProfileManager.
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center justify-between gap-4 mb-1">
        <h3 className="font-display text-[18px] font-semibold text-ink">Take payment at booking</h3>
        <Toggle on={requirePayment} onChange={(v) => { setRequirePayment(v); setSaved(false); }} label="Payment" />
      </div>
      <p className="text-[12.5px] text-ink-faint mb-4">
        Customers pay (card or bank transfer) to confirm a booking, instead of paying you separately after.
      </p>

      {!requirePayment && (
        // No Flutterwave/bank setup is required to use Vanova at all -
        // "pay at appointment" isn't a fallback, it's a genuinely fine,
        // fully supported way to run bookings.
        <div className="rounded-xl border border-line bg-warm-surface px-4 py-3.5 mb-5">
          <p className="text-[13px] text-ink-soft">
            Customers book without paying online - you collect payment however you normally do, in person or
            however works for you. No bank account needed here. You can turn payment collection on any time later.
          </p>
        </div>
      )}

      {requirePayment && (
        <div className="space-y-5 mb-5">
          <div>
            <span className={labelClass}>How much upfront</span>
            <div className="flex items-center gap-1 bg-warm-surface rounded-full p-1 w-fit">
              <button
                type="button"
                onClick={() => { setIsDeposit(false); setSaved(false); }}
                className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${!isDeposit ? 'bg-accent text-accent-contrast' : 'text-ink-faint hover:text-ink'}`}
              >
                Full amount
              </button>
              <button
                type="button"
                onClick={() => { setIsDeposit(true); setSaved(false); }}
                className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${isDeposit ? 'bg-accent text-accent-contrast' : 'text-ink-faint hover:text-ink'}`}
              >
                Deposit
              </button>
            </div>
            {isDeposit && (
              <div className="flex items-center gap-2 mt-3">
                {/* type="number" showed a stray leading zero on mobile
                    ("010") - confirmed live, a real quirk of how some
                    numeric-keyboard IMEs manage a number input's display
                    text semi-independently of React's own value. Text +
                    manual digit filtering instead, same pattern the
                    account number field above already uses - full
                    control over the exact string shown, no native
                    number-input behavior left to misbehave. */}
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Deposit percentage"
                  value={depositPercentage === 0 ? '' : depositPercentage}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                    const clamped = digits === '' ? 0 : Math.min(99, parseInt(digits, 10));
                    setDepositPercentage(clamped);
                    setSaved(false);
                  }}
                  className={`${smallInputClass} w-20`}
                />
                <span className="text-[13px] text-ink-faint">% of the service price, upfront</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={labelClass}>Payout account</span>
              {accountConnected && (
                <span className={connectedBadgeClass}>
                  <span className={connectedDotClass} />
                  Connected
                </span>
              )}
            </div>
            <p className="text-ink-faint text-[12px] mb-2.5">
              No Flutterwave account needed - just the bank account you want paid into. We never hold your money;
              every payment splits straight to this account.
            </p>

            {banksError && <p className="text-caption text-error mb-2">{banksError}</p>}

            <div className="space-y-2.5">
              {/* Country picks the bank list/currency below it, so it comes
                  first - changing it clears whatever bank was already
                  selected rather than leaving a Nigeria-only code sitting
                  under a Ghana label. */}
              <div className="flex items-center gap-1 bg-warm-surface rounded-full p-1 w-fit">
                {(['NG', 'GH'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (c === country) return;
                      setCountry(c);
                      setBankCode('');
                      setBankQuery('');
                      setBranchCode('');
                      setLinkedAccountName('');
                      setSaved(false);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${country === c ? 'bg-accent text-accent-contrast' : 'text-ink-faint hover:text-ink'}`}
                  >
                    {c === 'NG' ? 'Nigeria' : 'Ghana'}
                  </button>
                ))}
              </div>
              {/* Real search, not a plain <select> - with 20+ banks in an
                  unsorted list, typing to filter is the difference
                  between finding your bank and scrolling a wall of
                  names. A native input+datalist combo: real browser
                  search-as-you-type, no extra library. Typing a name
                  that doesn't exactly match anything leaves bankCode
                  unset (see onChange) rather than silently keeping a
                  stale selection from before the search started. */}
              <input
                aria-label="Bank"
                list="flutterwave-bank-options"
                value={bankQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setBankQuery(query);
                  const match = banks.find((b) => b.name === query);
                  setBankCode(match?.code ?? '');
                  setBranchCode('');
                  setLinkedAccountName('');
                  setSaved(false);
                }}
                placeholder={banks.length > 0 ? 'Search for your bank…' : 'Loading banks…'}
                autoComplete="off"
                className={inputClass}
              />
              <datalist id="flutterwave-bank-options">
                {banks.map((b) => (
                  <option key={b.code} value={b.name} />
                ))}
              </datalist>
              {bankQuery && !bankCode && (
                <p className="text-caption text-ink-faint">No bank matches &ldquo;{bankQuery}&rdquo; - pick one from the list.</p>
              )}
              {/* Ghana-only - Flutterwave needs a specific branch alongside
                  the bank + account number for a GH payout, a requirement
                  Nigeria never has. */}
              {country === 'GH' && bankCode && (
                <>
                  {branchesError && <p className="text-caption text-error">{branchesError}</p>}
                  <select
                    aria-label="Bank branch"
                    value={branchCode}
                    onChange={(e) => { setBranchCode(e.target.value); setLinkedAccountName(''); setSaved(false); }}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      {branches.length > 0 ? 'Select your branch' : 'Loading branches…'}
                    </option>
                    {branches.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <input
                aria-label="Account number"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10)); setLinkedAccountName(''); setSaved(false); }}
                placeholder="10-digit account number"
                className={inputClass}
              />
              {/* Only asked for once - the very first time an account is
                  linked. Flutterwave requires a phone number to create the
                  payout account at all; re-asking on every edit (even one
                  that doesn't change the bank details) would be friction
                  with nothing new to learn from it. */}
              {!accountConnected && (
                <input
                  aria-label="Business phone number"
                  type="tel"
                  value={businessMobile}
                  onChange={(e) => { setBusinessMobile(e.target.value); setSaved(false); }}
                  placeholder="Phone number for this account"
                  className={inputClass}
                />
              )}
            </div>

            {accountConnected ? (
              <p className="text-caption mt-3" style={{ color: 'var(--success)' }}>
                Verified: paying out to {linkedAccountName}.
              </p>
            ) : (
              // The live preview - shows up as soon as a real bank +
              // full account number are entered, well before Save is
              // ever clicked. Nothing here is saved yet; it's purely
              // "does this look like the right account" before
              // committing to it.
              <>
                {resolving && <p className="text-caption text-ink-faint mt-3">Checking that account…</p>}
                {!resolving && resolvedName && (
                  <p className="text-caption mt-3" style={{ color: 'var(--success)' }}>
                    Name on file: {resolvedName}
                  </p>
                )}
                {!resolving && resolveError && (
                  <p className="text-caption text-error mt-3">{resolveError}</p>
                )}
              </>
            )}

            <p className="text-ink-faint text-[12px] mt-2.5">
              We verify this account with Flutterwave before saving and show you the name on file, the same way a
              bank-transfer app confirms who you&rsquo;re paying before you send anything.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <span className={labelClass}>Accept payments in other currencies</span>
              <Toggle
                on={acceptForeignCurrency}
                onChange={(v) => { setAcceptForeignCurrency(v); setSaved(false); }}
                label="Foreign currency"
              />
            </div>
            <p className="text-ink-faint text-[12px] mt-2 leading-relaxed">
              Lets a customer outside Nigeria/Ghana pay you in their own currency (USD, KES, UGX, TZS, or ZAR)
              instead of {country === 'GH' ? 'GHS' : 'NGN'}. We convert it and forward the equivalent to your
              account above - a small extra step compared to a same-currency payment, which splits to you instantly.
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? <>Saved <CheckIcon className="h-3.5 w-3.5" /></> : 'Save'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
