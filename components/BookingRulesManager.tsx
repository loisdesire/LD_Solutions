'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import CheckIcon from './CheckIcon';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { inputClass, smallInputClass, labelClass } from './formStyles';

// Split out of what used to be SettingsManager - booking limits and the
// Zapier/Make webhook shared one Save button with Paystack keys, which
// meant editing a buffer time and editing a live payment credential were,
// as far as the UI was concerned, the same action. Now this half only
// ever touches booking_rules' non-payment columns.
export default function BookingRulesManager({
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
  const [cancellationWindowHours, setCancellationWindowHours] = useState(initialCancellationWindowHours);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();
  const router = useRouter();

  const bufferId = useId();
  const advanceId = useId();
  const cancellationId = useId();
  const webhookId = useId();

  const dirty =
    !saved &&
    (webhookUrl !== (initialWebhookUrl ?? '') ||
      bufferMinutes !== initialBufferMinutes ||
      maxAdvanceDays !== initialMaxAdvanceDays ||
      cancellationWindowHours !== initialCancellationWindowHours);
  useUnsavedChangesWarning(dirty);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const { error: rulesError } = await supabase
      .from('booking_rules')
      .update({
        webhook_url: webhookUrl || null,
        buffer_minutes: bufferMinutes,
        max_advance_days: maxAdvanceDays,
        cancellation_window_hours: cancellationWindowHours,
      })
      .eq('business_id', businessId);

    setSaving(false);

    if (rulesError) {
      setError(friendlyError(rulesError));
      return;
    }
    setSaved(true);
    // max_advance_days/cancellation_window_hours are read server-side by
    // the public booking page and the manage-booking page - same gap as
    // BusinessProfileManager.
    router.refresh();
  }

  // numInputClass/inputClass now shared from formStyles.ts as
  // smallInputClass/inputClass - same reasoning as BusinessProfileManager.
  // Wasn't even a mismatched <label> before - the text above each number
  // input was a plain styled <div>, no label element at all, so there
  // was nothing here for htmlFor to fix; this makes it a real one.
  const rule = (id: string, label: string, hint: string, value: number, onChange: (n: number) => void) => (
    <div className="py-3 border-b border-dashed border-line last:border-0">
      <label htmlFor={id} className="text-[14px] block">{label}</label>
      <div className="text-ink-faint text-[12px] mt-0.5 mb-2.5">{hint}</div>
      <input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
          setSaved(false);
        }}
        className={`${smallInputClass} w-24`}
      />
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div>
        <h3 className="font-display text-[18px] font-semibold text-ink mb-1">Booking limits</h3>
        <p className="text-[12.5px] text-ink-faint mb-2">Set the boundaries around each appointment.</p>
        {rule(bufferId, 'Buffer time', 'Gap kept free around every booking (minutes)', bufferMinutes, setBufferMinutes)}
        {rule(advanceId, 'Advance booking', 'How far ahead customers can book (days)', maxAdvanceDays, setMaxAdvanceDays)}
        {rule(
          cancellationId,
          'Cancellation window',
          'Minimum notice to cancel or reschedule (hours)',
          cancellationWindowHours,
          setCancellationWindowHours
        )}
      </div>

      <div className="border-t border-line pt-6">
        <h3 className="font-display text-[18px] font-semibold text-ink mb-1">Automation</h3>
        <p className="text-[12.5px] text-ink-faint mb-3">Send new bookings to another tool when they are created.</p>
        <label htmlFor={webhookId} className={labelClass}>
          Webhook URL
        </label>
        <input
          id={webhookId}
          type="url"
          value={webhookUrl}
          onChange={(e) => {
            setWebhookUrl(e.target.value);
            setSaved(false);
          }}
          className={inputClass}
          placeholder="https://hooks.zapier.com/..."
        />
        <p className="text-ink-faint text-[12px] mt-2">Send every booking to Zapier, Make, or your own CRM.</p>
      </div>

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
