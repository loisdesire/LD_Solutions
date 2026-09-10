'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

const MAX_AI_CONTEXT = 2000;
const DESCRIPTION_MAX = 160;

// Label only (schema: "not logic-branching"), but a short pick-list beats
// free text for the common cases; an existing unusual value is kept as
// its own option so saving never silently drops it.
const BUSINESS_TYPES = [
  'Salon',
  'Spa',
  'Barbershop',
  'Nail salon',
  'Beauty & skincare clinic',
  'Medical clinic',
  'Dental practice',
  'Therapist / counsellor',
  'Tutor / lessons',
  'Coach / consultant',
  'Fitness / wellness studio',
  'Photographer',
  'Other',
];

// Timezone genuinely drives availability (lib/getAvailableSlots.ts), so
// this needs to be a real IANA name, not free text - Africa first since
// that's the market, then the majors. An existing value outside the list
// is preserved the same way business type is.
const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Africa/Lagos', label: 'Lagos · West Africa (WAT)' },
  { value: 'Africa/Accra', label: 'Accra · Ghana (GMT)' },
  { value: 'Africa/Abidjan', label: 'Abidjan · Côte d’Ivoire' },
  { value: 'Africa/Nairobi', label: 'Nairobi · East Africa (EAT)' },
  { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam · Tanzania' },
  { value: 'Africa/Kampala', label: 'Kampala · Uganda' },
  { value: 'Africa/Kigali', label: 'Kigali · Rwanda' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg · South Africa (SAST)' },
  { value: 'Africa/Cairo', label: 'Cairo · Egypt' },
  { value: 'Africa/Casablanca', label: 'Casablanca · Morocco' },
  { value: 'Europe/London', label: 'London · UK' },
  { value: 'Europe/Paris', label: 'Paris · Central Europe' },
  { value: 'America/New_York', label: 'New York · US Eastern' },
  { value: 'America/Chicago', label: 'Chicago · US Central' },
  { value: 'America/Los_Angeles', label: 'Los Angeles · US Pacific' },
];

export default function BusinessProfileManager({
  slug,
  businessId,
  initialName,
  initialLogoUrl,
  initialAccentColor,
  initialCoverImageUrl,
  initialDescription,
  initialAiContext,
  initialBusinessType,
  initialTimezone,
}: {
  slug: string;
  businessId: string;
  initialName: string;
  initialLogoUrl: string | null;
  initialAccentColor: string;
  initialCoverImageUrl: string | null;
  initialDescription: string | null;
  initialAiContext: string | null;
  initialBusinessType: string | null;
  initialTimezone: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [aiContext, setAiContext] = useState(initialAiContext ?? '');
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [businessType, setBusinessType] = useState(initialBusinessType ?? '');
  const [timezone, setTimezone] = useState(initialTimezone || 'Africa/Lagos');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const typeOptions = initialBusinessType && !BUSINESS_TYPES.includes(initialBusinessType)
    ? [initialBusinessType, ...BUSINESS_TYPES]
    : BUSINESS_TYPES;
  const tzOptions =
    initialTimezone && !TIMEZONES.some((t) => t.value === initialTimezone)
      ? [{ value: initialTimezone, label: initialTimezone }, ...TIMEZONES]
      : TIMEZONES;

  const supabase = createBrowserSupabase();
  const router = useRouter();

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
        ai_context: aiContext.trim() || null,
        accent_color: accentColor,
        business_type: businessType.trim() || null,
        timezone: timezone || 'Africa/Lagos',
      })
      .eq('id', businessId);

    setSaving(false);

    if (updateError) {
      setError(friendlyError(updateError));
      return;
    }

    setSaved(true);
    // This form's own local state already reflects the new logo/accent/
    // name (it's what drove the update above), but nothing else on the
    // page does - AdminSidebar's avatar and AccentScope's CSS variable
    // are both set from a server-fetched `business` row in the shared
    // admin layout, rendered once per request. Writing straight to
    // Supabase from here never told Next anything changed, so both sat
    // stale until an unrelated hard navigation happened to re-render the
    // layout. router.refresh() re-runs the server components for the
    // current route (this one included) without losing this form's own
    // client state or doing a full page reload.
    router.refresh();
  }

  // inputClass/labelClass come from formStyles.ts - the shared 1px-border,
  // medium-weight-label style the rest of the admin already uses. This
  // file kept its own older copy (2px border, tiny-mono-uppercase label)
  // for a long time, which is why Settings looked a design pass behind
  // everything else.
  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Branding: logo + cover side by side, under one heading - the
          Stitch Profile screen's "Branding assets" pairing. This form
          used to split them into two separate headed sections ("Identity"
          / "Booking page appearance") with the logo field stranded
          between them. */}
      <div>
        <span className={labelClass}>Branding</span>
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start">
          <div>
            <ImageUploadField slug={slug} value={logoUrl} onChange={(url) => { setLogoUrl(url); setSaved(false); }} shape="avatar" label="Logo" />
            <p className="text-ink-faint text-[12px] mt-2">Square logo.</p>
          </div>
          <div>
            <ImageUploadField slug={slug} value={coverImageUrl} onChange={(url) => { setCoverImageUrl(url); setSaved(false); }} shape="banner" label="cover photo" />
            <p className="text-ink-faint text-[12px] mt-2">
              Wide banner across the top of your booking page. Without one, your accent colour is used.
            </p>
          </div>
        </div>
      </div>

      <Field label="Business name" required>
        {(props) => (
          <input
            {...props}
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            className={inputClass}
          />
        )}
      </Field>

      <Field
        label="Short description"
        hint={`Shown at the top of your booking page and in appointment reminders. ${DESCRIPTION_MAX - description.length} left.`}
      >
        {(props) => (
          <textarea
            {...props}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            placeholder="Lagos's go-to for natural hair care since 2019."
            className={inputClass}
          />
        )}
      </Field>

      {/* Business type + timezone - net new here. Both columns already
          exist on `businesses` but were only ever set during signup, with
          no way to fix them later. Timezone genuinely matters (it drives
          every slot on the calendar and the public page). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="bp-type">Business type</label>
          <select
            id="bp-type"
            value={businessType}
            onChange={(e) => { setBusinessType(e.target.value); setSaved(false); }}
            className={inputClass}
          >
            <option value="">Not set</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="bp-tz">Timezone</label>
          <select
            id="bp-tz"
            value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setSaved(false); }}
            className={inputClass}
          >
            {tzOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="text-ink-faint text-[12px] mt-2">
            Every time on your calendar and booking page is shown in this zone.
          </p>
        </div>
      </div>

      {/* Accent colour: booking-page appearance, kept as its own labelled
          block below the core fields rather than dropped. */}
      <div className="border-t border-line pt-6">
        <span className={labelClass}>Accent colour</span>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setAccentColor(c); setSaved(false); }}
              style={{ background: c }}
              className={`h-8 w-8 rounded-lg transition-all ${
                accentColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-2 ring-ink' : ''
              }`}
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Custom accent colour"
            value={accentColor}
            onChange={(e) => { setAccentColor(e.target.value); setSaved(false); }}
            className="h-9 w-12 rounded-lg border border-line-strong cursor-pointer"
          />
          <span className="font-mono text-[12px] text-ink-faint">{accentColor.toUpperCase()}</span>
        </div>
        <p className="text-ink-faint text-[12px] mt-2">
          Flows through your whole booking page - buttons, selected dates, times.
        </p>
      </div>

      {/* AI receptionist context - never shown publicly (only reaches the
          AI's own system prompt, see lib/whatsappAgent.ts). Its own block. */}
      <div className="border-t border-line pt-6">
        <Field
          label="Extra context for your AI receptionist"
          hint={`Never shown on your booking page - only your AI receptionist sees this. ${MAX_AI_CONTEXT - aiContext.length} left.`}
        >
          {(props) => (
            <textarea
              {...props}
              value={aiContext}
              onChange={(e) => { setAiContext(e.target.value); setSaved(false); }}
              maxLength={MAX_AI_CONTEXT}
              rows={5}
              placeholder="Anything that helps it answer real questions better - your specialties, house rules, what makes you different. E.g. &quot;Family-run since 2015, natural hair specialists. No weekend walk-ins, appointments only.&quot;"
              className={inputClass}
            />
          )}
        </Field>
      </div>

      {/* Save row: inline confirmation + a right-aligned button, the
          Stitch Profile screen's own footer treatment. */}
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
