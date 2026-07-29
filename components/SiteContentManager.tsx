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
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line-strong'}`}
      >
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

export default function SiteContentManager({
  businessId,
  initialAboutText,
  initialGalleryUrls,
  initialContactPhone,
  initialContactEmail,
  initialInstagramUrl,
  initialFacebookUrl,
  initialShowAbout,
  initialShowGallery,
  initialShowContact,
}: {
  businessId: string;
  initialAboutText: string | null;
  initialGalleryUrls: string | null;
  initialContactPhone: string | null;
  initialContactEmail: string | null;
  initialInstagramUrl: string | null;
  initialFacebookUrl: string | null;
  initialShowAbout: boolean;
  initialShowGallery: boolean;
  initialShowContact: boolean;
}) {
  const [aboutText, setAboutText] = useState(initialAboutText ?? '');
  const [galleryUrls, setGalleryUrls] = useState(initialGalleryUrls ?? '');
  const [contactPhone, setContactPhone] = useState(initialContactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? '');
  const [instagramUrl, setInstagramUrl] = useState(initialInstagramUrl ?? '');
  const [facebookUrl, setFacebookUrl] = useState(initialFacebookUrl ?? '');
  const [showAbout, setShowAbout] = useState(initialShowAbout);
  const [showGallery, setShowGallery] = useState(initialShowGallery);
  const [showContact, setShowContact] = useState(initialShowContact);
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
        show_about: showAbout,
        show_gallery: showGallery,
        show_contact: showContact,
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
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>About</label>
          <Toggle
            on={showAbout}
            onChange={(v) => {
              setShowAbout(v);
              setSaved(false);
            }}
            label="About page"
          />
        </div>
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
          Gets its own page, linked from your nav. Needs both the toggle on and text filled in to show up.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Gallery photos</label>
          <Toggle
            on={showGallery}
            onChange={(v) => {
              setShowGallery(v);
              setSaved(false);
            }}
            label="Gallery page"
          />
        </div>
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
        <p className="text-ink-faint text-[12px] mt-2">One photo URL per line. Also gets its own page.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Contact</label>
          <Toggle
            on={showContact}
            onChange={(v) => {
              setShowContact(v);
              setSaved(false);
            }}
            label="Contact page"
          />
        </div>
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
          All optional — only the ones you fill in show up, and only if the toggle above is on.
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
