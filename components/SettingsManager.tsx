'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

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

  const inputClass =
    'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder-muted/60 shadow-sm outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/10';
  const labelClass = 'block text-sm font-medium text-ink mb-1.5';

  return (
    <form
      onSubmit={handleSave}
      className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Buffer (min)</label>
          <input
            type="number"
            min={0}
            step={5}
            value={bufferMinutes}
            onChange={(e) => {
              setBufferMinutes(Number(e.target.value));
              setSaved(false);
            }}
            className={inputClass}
          />
          <p className="text-muted text-xs mt-2">Gap kept free around every booking.</p>
        </div>
        <div>
          <label className={labelClass}>Booking window (days)</label>
          <input
            type="number"
            min={1}
            value={maxAdvanceDays}
            onChange={(e) => {
              setMaxAdvanceDays(Number(e.target.value));
              setSaved(false);
            }}
            className={inputClass}
          />
          <p className="text-muted text-xs mt-2">How far ahead customers can book.</p>
        </div>
        <div>
          <label className={labelClass}>Cancel/reschedule cutoff (hrs)</label>
          <input
            type="number"
            min={0}
            value={cancellationWindowHours}
            onChange={(e) => {
              setCancellationWindowHours(Number(e.target.value));
              setSaved(false);
            }}
            className={inputClass}
          />
          <p className="text-muted text-xs mt-2">Minimum notice required to change a booking.</p>
        </div>
      </div>

      <div className="h-px bg-line" />

      <div>
        <label className={labelClass}>Webhook URL</label>
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
        <p className="text-muted text-xs mt-2">
          We'll POST a JSON payload here every time a new booking comes in — connect it to
          Zapier, Make, or your own CRM.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
