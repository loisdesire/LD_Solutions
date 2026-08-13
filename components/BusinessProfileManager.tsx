'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';
import ImageUploadField from './ImageUploadField';

// The platform's own bright/airy trio plus a handful of others real
// businesses might actually want as their own brand color — this is
// customer-facing branding a business picks for itself, not platform
// chrome, so it isn't limited to the admin dashboard's fixed palette.
const PRESETS = ['#FF6B4A', '#0D9488', '#0284C7', '#B5502F', '#2F5D42', '#A8792B', '#6B3450', '#1A1917'];

export default function BusinessProfileManager({
  slug,
  businessId,
  initialName,
  initialLogoUrl,
  initialAccentColor,
  initialCoverImageUrl,
  initialDescription,
}: {
  slug: string;
  businessId: string;
  initialName: string;
  initialLogoUrl: string | null;
  initialAccentColor: string;
  initialCoverImageUrl: string | null;
  initialDescription: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl);
  const [description, setDescription] = useState(initialDescription ?? '');
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
      .update({
        name,
        logo_url: logoUrl,
        cover_image_url: coverImageUrl,
        description: description.trim() || null,
        accent_color: accentColor,
      })
      .eq('id', businessId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
  }

  const inputClass =
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

  return (
    <form onSubmit={handleSave} className="space-y-5">
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
        <label className={labelClass}>Logo</label>
        <ImageUploadField slug={slug} value={logoUrl} onChange={(url) => { setLogoUrl(url); setSaved(false); }} shape="avatar" label="Logo" />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
          maxLength={160}
          rows={2}
          placeholder="Lagos's go-to for natural hair care since 2019."
          className={inputClass}
        />
        <p className="text-ink-faint text-[12px] mt-2">
          One or two lines, shown at the top of your booking page. {160 - description.length} left.
        </p>
      </div>

      <div>
        <label className={labelClass}>Cover photo</label>
        <ImageUploadField slug={slug} value={coverImageUrl} onChange={(url) => { setCoverImageUrl(url); setSaved(false); }} shape="banner" label="cover photo" />
        <p className="text-ink-faint text-[12px] mt-2">
          Wide banner across the top of your booking page. Without one, we use your accent color instead.
        </p>
      </div>

      <div>
        <label className={labelClass}>Accent color</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setAccentColor(c);
                setSaved(false);
              }}
              style={{ background: c }}
              className={`h-8 w-8 rounded-xl transition-all ${
                accentColor.toLowerCase() === c.toLowerCase()
                  ? 'ring-2 ring-offset-2 ring-ink'
                  : ''
              }`}
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => {
              setAccentColor(e.target.value);
              setSaved(false);
            }}
            className="h-9 w-12 rounded-xl border-2 border-line-strong cursor-pointer"
          />
          <span className="font-mono text-[12px] text-ink-faint">{accentColor.toUpperCase()}</span>
        </div>
        <p className="text-ink-faint text-[12px] mt-2">
          Flows through your whole booking page — buttons, selected dates, times.
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

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
