'use client';

import { useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';

// A grid of real photo uploads instead of a textarea where you paste
// URLs blind and only find out something's broken when you check the
// live Gallery page. Stored the same way as before under the hood (the
// `gallery_urls` column is still just newline-joined URLs, no schema
// change) — this only changes how a URL gets into that list.
function GalleryUploader({
  slug,
  urls,
  onChange,
}: {
  slug: string;
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(files: FileList) {
    setError('');
    setUploading(true);

    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/upload?slug=${slug}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'One or more uploads failed.');
        continue;
      }
      uploaded.push(data.url);
    }

    setUploading(false);
    if (uploaded.length > 0) onChange([...urls, ...uploaded]);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = '';
    if (files && files.length > 0) handleFiles(files);
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {urls.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-line-strong bg-paper group">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
              aria-label="Remove photo"
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'color-mix(in srgb, var(--ink) 70%, transparent)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-xl border-2 border-dashed border-line-strong flex flex-col items-center justify-center gap-1 text-ink-faint hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span className="text-[10.5px] font-medium">Add photo</span>
            </>
          )}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleSelect} className="hidden" />
      {error && <p className="text-[12px] text-error mt-2">{error}</p>}
    </div>
  );
}

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
  slug,
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
  slug: string;
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
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    (initialGalleryUrls ?? '').split('\n').map((u) => u.trim()).filter(Boolean)
  );
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
        gallery_urls: galleryUrls.length > 0 ? galleryUrls.join('\n') : null,
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
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
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
        <GalleryUploader
          slug={slug}
          urls={galleryUrls}
          onChange={(urls) => {
            setGalleryUrls(urls);
            setSaved(false);
          }}
        />
        <p className="text-ink-faint text-[12px] mt-2">Upload as many as you like. Also gets its own page.</p>
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
