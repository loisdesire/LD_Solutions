'use client';

import { useState, useEffect } from 'react';
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
}: {
  slug: string;
  businessId: string;
  initialRequirePayment: boolean;
  initialDepositPercentage: number | null;
  initialAccountName: string | null;
  initialBankCode: string | null;
  initialAccountNumber: string | null;
}) {
  const [requirePayment, setRequirePayment] = useState(initialRequirePayment);
  // null/100 both mean "full amount" - one flag (isDeposit) plus a number
  // kept separately means the percentage field doesn't get wiped out just
  // from toggling "Full amount" on and back off again.
  const [isDeposit, setIsDeposit] = useState(initialDepositPercentage != null && initialDepositPercentage < 100);
  const [depositPercentage, setDepositPercentage] = useState(
    initialDepositPercentage != null && initialDepositPercentage < 100 ? initialDepositPercentage : 50
  );

  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [banksError, setBanksError] = useState('');
  const [bankCode, setBankCode] = useState(initialBankCode ?? '');
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber ?? '');
  const [businessMobile, setBusinessMobile] = useState('');
  // Set once a save actually succeeds (this session or a prior one) -
  // separate from bankCode/accountNumber so editing either field without
  // saving doesn't make a previously-linked account look connected under
  // different numbers.
  const [linkedAccountName, setLinkedAccountName] = useState(initialAccountName ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();
  const router = useRouter();

  // Loaded once, on demand rather than on every render - a business that
  // never opens the payments toggle never pays for this request.
  useEffect(() => {
    if (!requirePayment || banks.length > 0 || banksError) return;
    fetch(`/api/settings/flutterwave/banks?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.banks)) setBanks(data.banks);
        else setBanksError(data.error ?? 'Could not load the bank list.');
      })
      .catch(() => setBanksError('Could not load the bank list.'));
  }, [requirePayment, banks.length, banksError, slug]);

  const accountConnected = linkedAccountName.trim() !== '';

  const dirty =
    !saved &&
    (requirePayment !== initialRequirePayment ||
      bankCode !== (initialBankCode ?? '') ||
      accountNumber !== (initialAccountNumber ?? ''));
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
    // time. Only runs when the account number or bank actually changed
    // from what's already linked.
    const accountChanged = bankCode !== (initialBankCode ?? '') || accountNumber !== (initialAccountNumber ?? '');

    if (requirePayment && accountChanged) {
      if (!bankCode || !accountNumber) {
        setSaving(false);
        setError('Pick a bank and enter an account number.');
        return;
      }
      try {
        const res = await fetch('/api/settings/flutterwave/link-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, bankCode, accountNumber, businessMobile }),
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
    // flw_account_number/flw_account_name server-side when the account
    // changed - this only ever needs to save the require_payment/deposit
    // toggle, which the client is allowed to write directly (same RLS
    // scope as every other business-owned setting).
    const { error: rulesError } = await supabase
      .from('booking_rules')
      .update({
        require_payment: requirePayment,
        deposit_percentage: requirePayment ? (isDeposit ? depositPercentage : 100) : null,
      })
      .eq('business_id', businessId);

    setSaving(false);

    if (rulesError) {
      setError(friendlyError(rulesError));
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
        <div className="rounded-2xl border border-line bg-warm-surface px-4 py-3.5 mb-5">
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
                <input
                  type="number"
                  min={1}
                  max={99}
                  aria-label="Deposit percentage"
                  value={depositPercentage}
                  onChange={(e) => { setDepositPercentage(Number(e.target.value)); setSaved(false); }}
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
              <select
                aria-label="Bank"
                value={bankCode}
                onChange={(e) => { setBankCode(e.target.value); setLinkedAccountName(''); setSaved(false); }}
                className={inputClass}
              >
                <option value="" disabled>
                  {banks.length > 0 ? 'Select your bank' : 'Loading banks…'}
                </option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
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

            {accountConnected && (
              <p className="text-caption mt-3" style={{ color: 'var(--success)' }}>
                Verified: paying out to {linkedAccountName}.
              </p>
            )}

            <p className="text-ink-faint text-[12px] mt-2.5">
              We verify this account with Flutterwave before saving and show you the name on file, the same way a
              bank-transfer app confirms who you&rsquo;re paying before you send anything.
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
