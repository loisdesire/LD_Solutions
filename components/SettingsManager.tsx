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
  const [activeCategory, setActiveCategory] = useState<'booking_page' | 'booking' | 'connections' | 'team' | 'billing'>('booking');
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? '');
  const [bufferMinutes, setBufferMinutes] = useState(initialBufferMinutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initialMaxAdvanceDays);
  const [cancellationWindowHours, setCancellationWindowHours] = useState(initialCancellationWindowHours);
  const [requirePayment, setRequirePayment] = useState(initialRequirePayment);
  const [isDeposit, setIsDeposit] = useState(initialDepositPercentage != null && initialDepositPercentage < 100);
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
    'w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-[13.5px] font-mono outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent';
  const inputClass =
    'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] font-mono outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5 font-semibold';

  const rule = (
    label: string,
    hint: string,
    value: number,
    onChange: (n: number) => void
  ) => (
    <div className="py-4 border-b border-line last:border-0 flex items-center justify-between gap-4">
      <div>
        <div className="text-[14px] font-medium text-ink">{label}</div>
        <div className="text-ink-soft text-[12.5px] mt-0.5">{hint}</div>
      </div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
          setSaved(false);
        }}
        className={`${numInputClass} w-24 shrink-0`}
      />
    </div>
  );

  const categories = [
    { key: 'booking' as const, label: 'Booking Rules & Payments' },
    { key: 'booking_page' as const, label: 'Booking Page Profile' },
    { key: 'connections' as const, label: 'Connections & Webhooks' },
    { key: 'team' as const, label: 'Team & Roles' },
    { key: 'billing' as const, label: 'Billing & Plan' },
  ];

  return (
    <div className="space-y-6">
      {/* Category Tab Strip */}
      <div className="flex border-b border-line overflow-x-auto gap-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`pb-3 px-3 text-[13.5px] font-medium transition-all border-b-2 whitespace-nowrap ${
              activeCategory === cat.key
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-8 max-w-2xl bg-surface p-6 rounded-2xl border border-line shadow-sm">
        {activeCategory === 'booking' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-[16px] font-bold text-ink mb-1">Booking Limits</h3>
              <p className="text-[12.5px] text-ink-soft mb-3">Set schedule boundaries, buffer intervals, and cancellation rules.</p>
              {rule('Buffer time', 'Gap kept free around every booking (minutes)', bufferMinutes, setBufferMinutes)}
              {rule('Advance booking', 'How far ahead customers can book (days)', maxAdvanceDays, setMaxAdvanceDays)}
              {rule('Cancellation window', 'Minimum notice to cancel or reschedule (hours)', cancellationWindowHours, setCancellationWindowHours)}
            </div>

            <div className="border-t border-line pt-6">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div>
                  <h3 className="font-display text-[16px] font-bold text-ink">Payment Requirements</h3>
                  <p className="text-[12.5px] text-ink-soft">Require customers to pay online via Paystack to confirm appointments.</p>
                </div>
                <Toggle on={requirePayment} onChange={(v) => { setRequirePayment(v); setSaved(false); }} label="Payment" />
              </div>

              {requirePayment && (
                <div className="space-y-5 mt-4 p-4 rounded-xl bg-surface-warm/50 border border-line">
                  <div>
                    <label className={labelClass}>Upfront Amount Required</label>
                    <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-1 w-fit">
                      <button
                        type="button"
                        onClick={() => { setIsDeposit(false); setSaved(false); }}
                        className={`px-3.5 py-1.5 rounded-md font-mono text-[11px] transition-colors ${!isDeposit ? 'bg-accent text-white font-semibold' : 'text-ink-soft hover:text-ink'}`}
                      >
                        Full amount
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsDeposit(true); setSaved(false); }}
                        className={`px-3.5 py-1.5 rounded-md font-mono text-[11px] transition-colors ${isDeposit ? 'bg-accent text-white font-semibold' : 'text-ink-soft hover:text-ink'}`}
                      >
                        Deposit %
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
                        <span className="text-[13px] text-ink-soft">% deposit required upfront</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className={labelClass}>Paystack API Keys</label>
                      {paystackConnected && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-success border border-success-border">
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
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeCategory === 'booking_page' && (
          <div className="space-y-4">
            <h3 className="font-display text-[16px] font-bold text-ink">Booking Page Branding</h3>
            <p className="text-[13px] text-ink-soft">
              Manage your business profile, branding color, logo, and cover image on your public customer booking portal.
            </p>
            <div className="p-4 rounded-xl bg-surface-warm/40 border border-line text-[13px] text-ink-soft">
              To customize site header images, business info, or custom domain mappings, navigate to your public business settings.
            </div>
          </div>
        )}

        {activeCategory === 'connections' && (
          <div className="space-y-4">
            <h3 className="font-display text-[16px] font-bold text-ink mb-1">Webhooks & External Connections</h3>
            <p className="text-[12.5px] text-ink-soft mb-3">Integrate real-time appointment events into Zapier, Make, or custom CRMs.</p>
            <label className={labelClass}>Webhook Delivery Endpoint</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setSaved(false);
              }}
              className={inputClass}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
            />
            <p className="text-ink-soft text-[12px]">
              Every new booking event will send a JSON POST payload directly to this URL.
            </p>
          </div>
        )}

        {activeCategory === 'team' && (
          <div className="space-y-4">
            <h3 className="font-display text-[16px] font-bold text-ink">Team & Staff Roles</h3>
            <p className="text-[13px] text-ink-soft">
              Invite team members, assign appointment calendars, and manage staff access permissions.
            </p>
          </div>
        )}

        {activeCategory === 'billing' && (
          <div className="space-y-4">
            <h3 className="font-display text-[16px] font-bold text-ink">Vanova Hub Subscription</h3>
            <p className="text-[13px] text-ink-soft">
              Your business is currently on the <strong>Vanova Core Subscription</strong> plan.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-line flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-6 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:bg-accent-hover active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              'Saving…'
            ) : saved ? (
              <>
                Saved <CheckIcon className="h-3.5 w-3.5" />
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          {error && <p className="text-sm text-error font-medium">{error}</p>}
        </div>
      </form>
    </div>
  );
}
