'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import CheckIcon from './CheckIcon';
import Toggle from './Toggle';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { inputClass, smallInputClass, labelClass, connectedBadgeClass, connectedDotClass } from './formStyles';

// Split out of what used to be SettingsManager - a live Paystack secret
// key used to share one Save button with buffer times and a Zapier
// webhook. Money handling gets its own section, own save action, and own
// server round-trip now, so it's never accidentally bundled with an
// unrelated edit.
export default function PaymentsManager({
  slug,
  businessId,
  initialRequirePayment,
  initialDepositPercentage,
  initialPaystackPublicKey,
  initialPaystackSecretKey,
}: {
  slug: string;
  businessId: string;
  initialRequirePayment: boolean;
  initialDepositPercentage: number | null;
  initialPaystackPublicKey: string | null;
  initialPaystackSecretKey: string | null;
}) {
  const [requirePayment, setRequirePayment] = useState(initialRequirePayment);
  // null/100 both mean "full amount" - one flag (isDeposit) plus a number
  // kept separately means the percentage field doesn't get wiped out just
  // from toggling "Full amount" on and back off again.
  const [isDeposit, setIsDeposit] = useState(initialDepositPercentage != null && initialDepositPercentage < 100);
  const [depositPercentage, setDepositPercentage] = useState(
    initialDepositPercentage != null && initialDepositPercentage < 100 ? initialDepositPercentage : 50
  );
  const [paystackPublicKey, setPaystackPublicKey] = useState(initialPaystackPublicKey ?? '');
  const [paystackSecretKey, setPaystackSecretKey] = useState(initialPaystackSecretKey ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyMode, setKeyMode] = useState<string | null>(
    // Derived on first render so the warning shows for keys saved earlier,
    // not only after a fresh save.
    () => (initialPaystackSecretKey?.startsWith('sk_live_') ? 'live' : initialPaystackSecretKey ? 'test' : null)
  );
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();

  const paystackConnected = paystackPublicKey.trim() !== '' && paystackSecretKey.trim() !== '';

  const dirty =
    !saved &&
    (requirePayment !== initialRequirePayment ||
      paystackPublicKey !== (initialPaystackPublicKey ?? '') ||
      paystackSecretKey !== (initialPaystackSecretKey ?? ''));
  useUnsavedChangesWarning(dirty);

  // Paystack's dashboard lets you copy each key separately, but people
  // routinely copy the whole block, or paste the secret into the first box
  // because it is first. Rather than tell them off, take whatever arrives
  // and put each key where it belongs.
  function absorbKeys(raw: string, field: 'public' | 'secret') {
    const pk = raw.match(/pk_(?:live|test)_[A-Za-z0-9]+/)?.[0];
    const sk = raw.match(/sk_(?:live|test)_[A-Za-z0-9]+/)?.[0];

    if (pk || sk) {
      if (pk) setPaystackPublicKey(pk);
      if (sk) setPaystackSecretKey(sk);
      // A single key pasted into the wrong box: it has been filed
      // correctly above, so clear where it landed.
      if (field === 'public' && !pk && sk) setPaystackPublicKey('');
      if (field === 'secret' && !sk && pk) setPaystackSecretKey('');
      return;
    }

    // Nothing key-shaped yet - they are still typing, or it is being
    // cleared. Leave it alone so the field stays editable.
    if (field === 'public') setPaystackPublicKey(raw.trim());
    else setPaystackSecretKey(raw.trim());
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    setKeyMode(null);

    // Check the keys with Paystack before storing them. A wrong secret key
    // otherwise surfaces only when a real customer fails to pay, and test
    // keys never surface at all: checkout looks normal, the customer sees
    // success, the booking confirms, and the business is paid nothing.
    try {
      const res = await fetch('/api/settings/paystack/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, secretKey: paystackSecretKey, publicKey: paystackPublicKey }),
      });
      const check = await res.json();
      if (!res.ok || !check.ok) {
        setSaving(false);
        setError(check.error ?? 'Could not check those Paystack keys. Nothing was saved.');
        return;
      }
      setKeyMode(check.mode ?? null);
    } catch {
      setSaving(false);
      setError("Couldn't reach the server to check your Paystack keys. Nothing was saved.");
      return;
    }

    const [{ error: rulesError }, { error: bizError }] = await Promise.all([
      supabase
        .from('booking_rules')
        .update({
          require_payment: requirePayment,
          deposit_percentage: requirePayment ? (isDeposit ? depositPercentage : 100) : null,
        })
        .eq('business_id', businessId),
      supabase
        .from('businesses')
        .update({
          paystack_public_key: paystackPublicKey.trim() || null,
          paystack_secret_key: paystackSecretKey.trim() || null,
        })
        .eq('id', businessId),
    ]);

    setSaving(false);

    if (rulesError || bizError) {
      // Missed in the earlier friendlyError sweep - this one's a
      // parenthesized `(a ?? b)!.message` expression, not the plain
      // `xError.message` shape that pass's grep was looking for. Same
      // raw-Postgres-string-on-a-money-page bug, just harder to find.
      setError(friendlyError(rulesError ?? bizError));
      return;
    }
    setSaved(true);
  }

  // numInputClass/inputClass/labelClass now shared from formStyles.ts as
  // smallInputClass/inputClass/labelClass - same reasoning as
  // BusinessProfileManager.

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center justify-between gap-4 mb-1">
        <h3 className="font-display text-[18px] font-semibold text-ink">Take payment at booking</h3>
        <Toggle on={requirePayment} onChange={(v) => { setRequirePayment(v); setSaved(false); }} label="Payment" />
      </div>
      <p className="text-[12.5px] text-ink-faint mb-4">
        Customers pay through Paystack (card or bank transfer) to confirm a booking, instead of paying you separately after.
      </p>

      {requirePayment && (
        <div className="space-y-5 mb-5">
          <div>
            {/* A caption over a compound control (two toggle buttons, plus
                a conditional number field below), not a label for one
                input - a <label> with no htmlFor is still valid HTML, but
                doesn't actually claim an association it can't back up. */}
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
              {/* Same reasoning as "How much upfront" above - this
                  captions two separate key fields, not one. */}
              <span className={labelClass}>Paystack keys</span>
              {paystackConnected && (
                <span className={connectedBadgeClass}>
                  <span className={connectedDotClass} />
                  Connected
                </span>
              )}
            </div>
            {/* Two labelled boxes asked the owner to know which key was
                which, which is exactly the bit a non-technical person gets
                wrong: keys swapped, or the same one pasted twice. Both
                fields sort out whatever lands in them, so pasting either
                key into either box works, and pasting the whole block
                copied from Paystack fills both at once. */}
            <div className="space-y-2.5">
              <input
                aria-label="Paystack public key"
                value={paystackPublicKey}
                onChange={(e) => { absorbKeys(e.target.value, 'public'); setSaved(false); }}
                placeholder="Paste your public key (pk_...)"
                className={inputClass}
              />
              <input
                type={paystackSecretKey.startsWith('sk_') ? 'password' : 'text'}
                aria-label="Paystack secret key"
                value={paystackSecretKey}
                onChange={(e) => { absorbKeys(e.target.value, 'secret'); setSaved(false); }}
                placeholder="Paste your secret key (sk_...)"
                className={inputClass}
              />
            </div>
            {keyMode === 'test' && (
              <div role="alert" className="mt-3 rounded-xl bg-warning-bg border border-warning-border px-3.5 py-3">
                <p className="text-caption text-warning">
                  <strong className="font-semibold">These are test keys.</strong> Checkout will look completely
                  normal to your customers and their bookings will confirm, but no money is collected and nothing
                  reaches your account. Swap them for your live keys before taking real bookings.
                </p>
              </div>
            )}
            {keyMode === 'live' && (
              <p className="text-caption mt-3" style={{ color: 'var(--success)' }}>
                Live keys checked and accepted by Paystack.
              </p>
            )}

            {/* Was a single line naming a menu path. For someone who has
                never opened Paystack, "Settings then API Keys and
                Webhooks" is not instructions, it is a place they have to
                go find. */}
            <ol className="text-ink-faint text-[12px] mt-3 space-y-1.5 list-decimal pl-4">
              <li>
                Open{' '}
                <a
                  href="https://dashboard.paystack.com/#/settings/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2"
                  style={{ color: 'var(--accent)' }}
                >
                  your Paystack API keys page
                </a>
                . Create a free Paystack account first if you do not have one.
              </li>
              <li>Copy the Public Key and paste it above. Copy the Secret Key and paste it above too.</li>
              <li>Press Save. We check both with Paystack straight away and tell you if anything is wrong.</li>
            </ol>
            <p className="text-ink-faint text-[12px] mt-2.5">
              Either key can go in either box, we sort them out. Payments go straight to your own Paystack
              account. We never hold your money.
            </p>

            {/* Only matters once keys are in, so it stays out of the way
                until then. Without this webhook a chat booking still
                works. The customer just has to say "I've paid" for it to
                be checked, instead of it confirming by itself. */}
            {paystackSecretKey && (
              <div className="mt-4 rounded-xl bg-warm-surface p-3.5">
                <p className="text-ink text-[12.5px] font-semibold mb-1">One more step, for chat bookings</p>
                <p className="text-ink-soft text-[12px] leading-relaxed mb-2">
                  Paste this into Paystack (Settings → API Keys &amp; Webhooks → Webhook URL) so bookings made
                  through chat confirm themselves the moment a customer pays. Without it they still work, but the
                  customer has to tell the assistant they&apos;ve paid.
                </p>
                <code className="block rounded-lg bg-surface px-3 py-2 font-mono text-[11.5px] text-ink break-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/paystack
                </code>
              </div>
            )}
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
