'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import CheckIcon from './CheckIcon';
import ImageUploadField from './ImageUploadField';
import { inputClass, labelClass } from './formStyles';
import Field from './Field';

// The platform's own terracotta + cream identity leads the list, plus a
// handful of others real businesses might actually want as their own
// brand color - this is customer-facing branding a business picks for
// itself, not platform chrome, so it isn't limited to the platform's
// own fixed palette.
const PRESETS = ['#C4512D', '#F3E8BC', '#8E6A4A', '#2F5D42', '#171717', '#6B3450', '#1769AA', '#1A1917'];

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
      setError(friendlyError(updateError));
      return;
    }

    setSaved(true);
  }

  // inputClass/labelClass now come from formStyles.ts - this file had its
  // own local copy of the OLD style (2px border, tiny-mono-uppercase
  // label), which formStyles.ts moved away from a while back (1px
  // border, plain medium-weight label) - ServicesManager/ProductsManager/
  // StaffManager already picked that up, this file just never did, so
  // Settings visibly looked like an older design pass than the rest of
  // the admin. Importing the shared one fixes the duplication AND that
  // drift in the same move.
  // Section headers were 16px with no explicit weight - font-display's
  // own base weight, which reads barely heavier than the 14px input text
  // sitting right under it, and noticeably LESS prominent than
  // SetupChecklist's card heading a few clicks away (17px, font-semibold)
  // despite being a more important piece of structure here, not less.
  const sectionHeadingClass = 'font-display text-[18px] font-semibold text-ink mb-4';

  return (
    <form onSubmit={handleSave} className="space-y-9">
      {/* Logo used to sit in its own unheaded div between "Identity" and
          "Booking page appearance" - inside neither section, so nothing
          on screen said which group it belonged to. It's an identity
          field, not a page-appearance one (the business's own mark, same
          category as its name), so it moves under Identity properly.
          space-y-5 inside a group vs. space-y-9 between groups - the
          groups themselves need to read as the real structure, not
          every field sitting at identical distance from every other. */}
      <div>
        <h3 className={sectionHeadingClass}>Identity</h3>
        <div className="space-y-5">
          <Field label="Business name" required>
            {(props) => (
              <input
                {...props}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                className={inputClass}
              />
            )}
          </Field>
          <div>
            {/* Caption, not a field label - the real control below (the
                "Upload logo"/"Change logo" button) already names itself
                in its own visible text, so there's no single unlabeled
                input for htmlFor to point at. */}
            <span className={labelClass}>Logo</span>
            <ImageUploadField slug={slug} value={logoUrl} onChange={(url) => { setLogoUrl(url); setSaved(false); }} shape="avatar" label="Logo" />
          </div>
        </div>
      </div>

      <div className="border-t border-line pt-6">
        <h3 className={sectionHeadingClass}>Booking page appearance</h3>
        <div className="space-y-5">
          <Field
            label="Description"
            hint={`One or two lines, shown at the top of your booking page. ${160 - description.length} left.`}
          >
            {(props) => (
              <textarea
                {...props}
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
            )}
          </Field>

          <div>
            <span className={labelClass}>Cover photo</span>
            <ImageUploadField slug={slug} value={coverImageUrl} onChange={(url) => { setCoverImageUrl(url); setSaved(false); }} shape="banner" label="cover photo" />
            <p className="text-ink-faint text-[12px] mt-2">
              Wide banner across the top of your booking page. Without one, we use your accent color instead.
            </p>
          </div>

          <div>
            {/* Captions a compound control (preset swatches + native
                color picker + hex readout), not one input. */}
            <span className={labelClass}>Accent color</span>
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
                aria-label="Custom accent color"
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
              Flows through your whole booking page - buttons, selected dates, times.
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
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
