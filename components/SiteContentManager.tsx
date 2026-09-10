'use client';

import { useRef, useState, useId } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import CheckIcon from './CheckIcon';
import Toggle from './Toggle';
import { inputClass } from './formStyles';
import Icon from './Icon';

// A grid of real photo uploads instead of a textarea where you paste
// URLs blind and only find out something's broken when you check the
// live Gallery page. Stored the same way as before under the hood (the
// `gallery_urls` column is still just newline-joined URLs, no schema
// change) - this only changes how a URL gets into that list.
function GalleryUploader({
  slug,
  urls,
  onChange,
  labelId,
}: {
  slug: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  /** id of the "Gallery photos" label above this widget - applied as an aria-label reference on the file input, since the input itself is visually hidden and triggered by the "Add photo" button, not the label directly. */
  labelId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(files: FileList) {
    setError('');
    setUploading(true);

    const uploaded: string[] = [];
    let failed = 0;
    // try/finally around the whole batch: a network throw mid-loop used
    // to escape the function entirely, leaving the spinner stuck forever
    // and silently discarding any files that had already succeeded.
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch(`/api/upload?slug=${slug}`, { method: 'POST', body: formData });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            failed += 1;
            continue;
          }
          uploaded.push(data.url);
        } catch {
          failed += 1;
        }
      }
    } finally {
      setUploading(false);
      // Keep whatever did upload rather than throwing the batch away.
      if (uploaded.length > 0) onChange([...urls, ...uploaded]);
      if (failed > 0) {
        setError(
          failed === 1 ? "One photo didn't upload. Please try it again." : `${failed} photos didn't upload. Please try them again.`
        );
      }
    }
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
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-line-strong bg-paper group">
            <Image src={url} alt={`Gallery photo ${i + 1} preview`} fill sizes="150px" className="object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
              aria-label="Remove photo"
              // Was opacity-0 + group-hover only: on a touch device there
              // is no hover, so the delete button was completely
              // unreachable - and keyboard focus never revealed it either.
              // Always visible below sm, hover/focus-revealed above it.
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full text-white flex items-center justify-center transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
              style={{ background: 'color-mix(in srgb, var(--ink) 70%, transparent)' }}
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-xl border border-dashed border-line-strong flex flex-col items-center justify-center gap-1 text-ink-faint hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          ) : (
            <>
              <Icon name="add_photo_alternate" size={20} />
              <span className="text-[10.5px] font-medium">Add photo</span>
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleSelect}
        className="hidden"
        aria-labelledby={labelId}
      />
      {error && <p className="text-[12px] text-error mt-2">{error}</p>}
    </div>
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
  const router = useRouter();

  // Each of these three labels sits next to a Toggle, not directly above
  // its own field, so Field.tsx's rigid label-then-input layout doesn't
  // fit here - real htmlFor/id association wired by hand instead. These
  // were the "visually adjacent, not actually associated" case; the
  // label was real, it just didn't point at anything.
  const aboutId = useId();
  const galleryId = useId();

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
      setError(friendlyError(updateError));
      return;
    }

    setSaved(true);
    // Same gap as BusinessProfileManager - showAbout/showGallery/
    // showContact are read server-side by the public site pages and
    // SiteHeader's nav; a client-only Supabase write never told Next to
    // re-render anything already on screen server-side.
    router.refresh();
  }

  // inputClass/labelClass shared from formStyles.ts (see
  // BusinessProfileManager's comment). Group heading = the field's own
  // <label> styled up, with the show/hide Toggle sitting on the same
  // row - the Stitch "Booking page" screen's own treatment (heading +
  // "Show on booking page" switch as one line per group), instead of a
  // heading, then a redundant smaller label, then the toggle.
  const groupHeadingClass = 'font-display text-[16px] font-semibold text-ink';

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <label htmlFor={aboutId} className={groupHeadingClass}>About</label>
          <Toggle
            on={showAbout}
            onChange={(v) => { setShowAbout(v); setSaved(false); }}
            label="About page"
          />
        </div>
        <textarea
          id={aboutId}
          value={aboutText}
          onChange={(e) => { setAboutText(e.target.value); setSaved(false); }}
          rows={4}
          placeholder="Tell customers who you are and what makes your place worth visiting."
          className={inputClass}
        />
        <p className="text-ink-faint text-[12px] mt-2">
          Shown at the top of your booking page, and gets its own linked page. Needs the toggle on and text filled in.
        </p>
      </div>

      <div className="border-t border-line pt-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span id={galleryId} className={groupHeadingClass}>Gallery</span>
          <Toggle
            on={showGallery}
            onChange={(v) => { setShowGallery(v); setSaved(false); }}
            label="Gallery page"
          />
        </div>
        <GalleryUploader
          slug={slug}
          urls={galleryUrls}
          labelId={galleryId}
          onChange={(urls) => { setGalleryUrls(urls); setSaved(false); }}
        />
        <p className="text-ink-faint text-[12px] mt-2">Photos of your space, your work, your team. Also gets its own page.</p>
      </div>

      <div className="border-t border-line pt-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className={groupHeadingClass}>Contact details</span>
          <Toggle
            on={showContact}
            onChange={(v) => { setShowContact(v); setSaved(false); }}
            label="Contact page"
          />
        </div>
        {/* 2-up grid, matching the Stitch screen (phone/email, then the
            two socials) rather than a single stacked column. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="tel"
            aria-label="Phone number"
            value={contactPhone}
            onChange={(e) => { setContactPhone(e.target.value); setSaved(false); }}
            placeholder="Phone number"
            className={inputClass}
          />
          <input
            type="email"
            aria-label="Email address"
            value={contactEmail}
            onChange={(e) => { setContactEmail(e.target.value); setSaved(false); }}
            placeholder="Email address"
            className={inputClass}
          />
          <input
            type="url"
            aria-label="Instagram link"
            value={instagramUrl}
            onChange={(e) => { setInstagramUrl(e.target.value); setSaved(false); }}
            placeholder="Instagram link"
            className={inputClass}
          />
          <input
            type="url"
            aria-label="Facebook link"
            value={facebookUrl}
            onChange={(e) => { setFacebookUrl(e.target.value); setSaved(false); }}
            placeholder="Facebook link"
            className={inputClass}
          />
        </div>
        <p className="text-ink-faint text-[12px] mt-2">
          All optional - only the ones you fill in show, and only with the toggle on.
        </p>
      </div>

      <div className="border-t border-line pt-5 flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-caption text-success">
            <CheckIcon className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {error && <span className="text-caption text-error">{error}</span>}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-[13px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
