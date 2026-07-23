'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';

export default function SiteContentManager({
  businessId,
  initialAboutText,
  initialGalleryUrls,
  initialContactPhone,
  initialContactEmail,
  initialInstagramUrl,
  initialFacebookUrl,
}: {
  businessId: string;
  initialAboutText: string | null;
  initialGalleryUrls: string | null;
  initialContactPhone: string | null;
  initialContactEmail: string | null;
  initialInstagramUrl: string | null;
  initialFacebookUrl: string | null;
}) {
  const [aboutText, setAboutText] = useState(initialAboutText ?? '');
  const [galleryUrls, setGalleryUrls] = useState(initialGalleryUrls ?? '');
  const [contactPhone, setContactPhone] = useState(initialContactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? '');
  const [instagramUrl, setInstagramUrl] = useState(initialInstagramUrl ?? '');
  const [facebookUrl, setFacebookUrl] = useState(initialFacebookUrl ?? '');
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
        about_text: aboutText.trim() || null,
        gallery_urls: galleryUrls.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        facebook_url: facebookUrl.trim() || null,
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
    'w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <label className={labelClass}>About</label>
        <textarea
          value={aboutText}
          onChange={(e) => {
            setAboutText(e.target.value);
            setSaved(false);
          }}
          rows={4}
          placeholder="Tell customers who you are and what makes your place worth visiting."
          className={inputClass}
        />
        <p className="text-ink-faint text-[12px] mt-2">
          Shown in its own section on your booking page. Leave blank to hide it.
        </p>
      </div>

      <div>
        <label className={labelClass}>Gallery photos</label>
        <textarea
          value={galleryUrls}
          onChange={(e) => {
            setGalleryUrls(e.target.value);
            setSaved(false);
          }}
          rows={4}
          placeholder={'https://…\nhttps://…\nhttps://…'}
          className={inputClass}
        />
        <p className="text-ink-faint text-[12px] mt-2">
          One photo URL per line. Shown as a gallery on your booking page.
        </p>
      </div>

      <div>
        <label className={labelClass}>Contact</label>
        <div className="space-y-2.5">
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => {
              setContactPhone(e.target.value);
              setSaved(false);
            }}
            placeholder="Phone number"
            className={inputClass}
          />
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => {
              setContactEmail(e.target.value);
              setSaved(false);
            }}
            placeholder="Email address"
            className={inputClass}
          />
          <input
            type="url"
            value={instagramUrl}
            onChange={(e) => {
              setInstagramUrl(e.target.value);
              setSaved(false);
            }}
            placeholder="Instagram link"
            className={inputClass}
          />
          <input
            type="url"
            value={facebookUrl}
            onChange={(e) => {
              setFacebookUrl(e.target.value);
              setSaved(false);
            }}
            placeholder="Facebook link"
            className={inputClass}
          />
        </div>
        <p className="text-ink-faint text-[12px] mt-2">
          All optional — only the ones you fill in show up on your booking page.
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
