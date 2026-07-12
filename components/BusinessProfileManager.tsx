'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

export default function BusinessProfileManager({
  businessId,
  initialName,
  initialLogoUrl,
  initialAccentColor,
}: {
  businessId: string;
  initialName: string;
  initialLogoUrl: string | null;
  initialAccentColor: string;
}) {
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '');
  const [accentColor, setAccentColor] = useState(initialAccentColor);
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
      .from('businesses')
      .update({ name, logo_url: logoUrl || null, accent_color: accentColor })
      .eq('id', businessId);

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
      <div>
        <label className={labelClass}>Business name</label>
        <input
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Logo URL</label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => {
            setLogoUrl(e.target.value);
            setSaved(false);
          }}
          className={inputClass}
          placeholder="https://…"
        />
      </div>

      <div>
        <label className={labelClass}>Accent color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => {
              setAccentColor(e.target.value);
              setSaved(false);
            }}
            className="h-11 w-14 rounded-lg border border-line shadow-sm cursor-pointer"
          />
          <input
            value={accentColor}
            onChange={(e) => {
              setAccentColor(e.target.value);
              setSaved(false);
            }}
            className={`${inputClass} flex-1`}
          />
        </div>
        <p className="text-muted text-xs mt-2">
          Used as a highlight color on your public booking page.
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
