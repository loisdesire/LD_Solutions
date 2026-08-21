'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="flex items-center gap-2 shrink-0"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line-strong'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            on ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className="text-[12px] font-medium text-ink-soft">{on ? `${label} on` : `${label} off`}</span>
    </button>
  );
}

export default function SettingsManager({
  businessId,
  initialWebhookUrl,
  initialBufferMinutes,
  initialMaxAdvanceDays,
  initialCancellationWindowHours,
  initialRequirePayment,
  initialDepositPercentage,
  initialPaystackPublicKey,
  initialPaystackSecretKey,
}: {
  businessId: string;
  initialWebhookUrl: string | null;
  initialBufferMinutes: number;
  initialMaxAdvanceDays: number;
  initialCancellationWindowHours: number;
  initialRequirePayment: boolean;
  initialDepositPercentage: number | null;
  initialPaystackPublicKey: string | null;
  initialPaystackSecretKey: string | null;
}) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? '');
  const [bufferMinutes, setBufferMinutes] = useState(initialBufferMinutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initialMaxAdvanceDays);
  const [cancellationWindowHours, setCancellationWindowHours] = useState(
    initialCancellationWindowHours
  );
  const [requirePayment, setRequirePayment] = useState(initialRequirePayment);
  // null/100 both mean "full amount" — one flag (isDeposit) plus a number
  // kept separately means the percentage field doesn't get wiped out just
  // from toggling "Full amount" on and back off again.
  const [isDeposit, setIsDeposit] = useState(
    initialDepositPercentage != null && initialDepositPercentage < 100
  );
  const [depositPercentage, setDepositPercentage] = useState(
    initialDepositPercentage != null && initialDepositPercentage < 100 ? initialDepositPercentage : 50
  );
  const [paystackPublicKey, setPaystackPublicKey] = useState(initialPaystackPublicKey ?? '');
  const [paystackSecretKey, setPaystackSecretKey] = useState(initialPaystackSecretKey ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();

  const paystackConnected = paystackPublicKey.trim() !== '' && paystackSecretKey.trim() !== '';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const [{ error: rulesError }, { error: bizError }] = await Promise.all([
      supabase
        .from('booking_rules')
        .update({
          webhook_url: webhookUrl || null,
          buffer_minutes: bufferMinutes,
          max_advance_days: maxAdvanceDays,
          cancellation_window_hours: cancellationWindowHours,
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
      setError((rulesError ?? bizError)!.message);
      return;
    }

    setSaved(true);
  }

  const numInputClass =
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3 py-1.5 text-[13.5px] font-mono outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const inputClass =
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[13px] font-mono outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

  const rule = (
    label: string,
    hint: string,
    value: number,
    onChange: (n: number) => void
  ) => (
    <div className="py-3 border-b border-dashed border-line last:border-0">
      <div className="text-[14px]">{label}</div>
      <div className="text-ink-faint text-[12px] mt-0.5 mb-2.5">{hint}</div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
          setSaved(false);
        }}
        className={`${numInputClass} w-24`}
      />
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div>
        <h3 className="font-display text-[16px] text-ink mb-1">Booking limits</h3>
        <p className="text-[12.5px] text-ink-faint mb-2">Set the boundaries around each appointment.</p>
        {rule('Buffer time', 'Gap kept free around every booking (minutes)', bufferMinutes, setBufferMinutes)}
        {rule('Advance booking', 'How far ahead customers can book (days)', maxAdvanceDays, setMaxAdvanceDays)}
        {rule(
          'Cancellation window',
          'Minimum notice to cancel or reschedule (hours)',
          cancellationWindowHours,
          setCancellationWindowHours
        )}
      </div>

      <div className="border-t border-line pt-6">
        <div className="flex items-center justify-between gap-4 mb-1">
          <h3 className="font-display text-[16px] text-ink">Payments</h3>
          <Toggle on={requirePayment} onChange={(v) => { setRequirePayment(v); setSaved(false); }} label="Payment" />
        </div>
        <p className="text-[12.5px] text-ink-faint mb-4">
          Customers pay through Paystack (card or bank transfer) to confirm a booking, instead of paying you separately after.
        </p>

        {requirePayment && (
          <div className="space-y-5 mb-5">
            <div>
              <label className={labelClass}>How much upfront</label>
              <div className="flex items-center gap-1 bg-warm-surface rounded-full p-1 w-fit">
                <button
                  type="button"
                  onClick={() => { setIsDeposit(false); setSaved(false); }}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${!isDeposit ? 'bg-accent text-white' : 'text-ink-faint hover:text-ink'}`}
                >
                  Full amount
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDeposit(true); setSaved(false); }}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${isDeposit ? 'bg-accent text-white' : 'text-ink-faint hover:text-ink'}`}
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
                    value={depositPercentage}
                    onChange={(e) => { setDepositPercentage(Number(e.target.value)); setSaved(false); }}
                    className={`${numInputClass} w-20`}
                  />
                  <span className="text-[13px] text-ink-faint">% of the service price, upfront</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className={labelClass}>Paystack keys</label>
                {paystackConnected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    Connected
                  </span>
                )}
              </div>
              <div className="space-y-2.5">
                <input
                  value={paystackPublicKey}
                  onChange={(e) => { setPaystackPublicKey(e.target.value); setSaved(false); }}
                  placeholder="pk_live_..."
                  className={inputClass}
                />
                <input
                  type="password"
                  value={paystackSecretKey}
                  onChange={(e) => { setPaystackSecretKey(e.target.value); setSaved(false); }}
                  placeholder="sk_live_..."
                  className={inputClass}
                />
              </div>
              <p className="text-ink-faint text-[12px] mt-2">
                From your own Paystack dashboard (Settings → API Keys & Webhooks). Payments go straight to
                your Paystack account — we never touch the money.
              </p>

              {/* Only matters once keys are in, so it stays out of the way
                  until then. Without this webhook a chat booking still
                  works — the customer just has to say "I've paid" for it to
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
      </div>

      <div className="border-t border-line pt-6">
        <h3 className="font-display text-[16px] text-ink mb-1">Automation</h3>
        <p className="text-[12.5px] text-ink-faint mb-3">Send new bookings to another tool when they are created.</p>
        <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => {
            setWebhookUrl(e.target.value);
            setSaved(false);
          }}
          className={inputClass}
          placeholder="https://hooks.zapier.com/..."
        />
        <p className="text-ink-faint text-[12px] mt-2">
          Send every booking to Zapier, Make, or your own CRM.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {saving ? (
          'Saving…'
        ) : saved ? (
          <>
            Saved <CheckIcon className="h-3.5 w-3.5" />
          </>
        ) : (
          'Save'
        )}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
