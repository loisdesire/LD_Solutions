'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';

export default function SettingsManager({
  businessId,
  initialWebhookUrl,
  initialBufferMinutes,
  initialMaxAdvanceDays,
  initialCancellationWindowHours,
}: {
  businessId: string;
  initialWebhookUrl: string | null;
  initialBufferMinutes: number;
  initialMaxAdvanceDays: number;
  initialCancellationWindowHours: number;
}) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? '');
  const [bufferMinutes, setBufferMinutes] = useState(initialBufferMinutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initialMaxAdvanceDays);
  const [cancellationWindowHours, setCancellationWindowHours] = useState(
    initialCancellationWindowHours
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const { error: updateError } = await supabase
      .from('booking_rules')
      .update({
        webhook_url: webhookUrl || null,
        buffer_minutes: bufferMinutes,
        max_advance_days: maxAdvanceDays,
        cancellation_window_hours: cancellationWindowHours,
      })
      .eq('business_id', businessId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
  }

  const numInputClass =
    'w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[13.5px] font-mono outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

  const rule = (
    label: string,
    hint: string,
    value: number,
    onChange: (n: number) => void
  ) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-dashed border-line last:border-0">
      <div>
        <div className="text-[14px]">{label}</div>
        <div className="text-ink-faint text-[12px] mt-0.5">{hint}</div>
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

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        {rule('Buffer time', 'Gap kept free around every booking (minutes)', bufferMinutes, setBufferMinutes)}
        {rule('Advance booking', 'How far ahead customers can book (days)', maxAdvanceDays, setMaxAdvanceDays)}
        {rule(
          'Cancellation window',
          'Minimum notice to cancel or reschedule (hours)',
          cancellationWindowHours,
          setCancellationWindowHours
        )}
      </div>

      <div>
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
          className="w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[13px] font-mono outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
          placeholder="https://hooks.zapier.com/..."
        />
        <p className="text-ink-faint text-[12px] mt-2">
          Send every booking to Zapier, Make, or your own CRM.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
