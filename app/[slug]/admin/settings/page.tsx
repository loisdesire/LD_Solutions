import { requireStaffSession } from '@/lib/requireStaffSession';
import BusinessProfileManager from '@/components/BusinessProfileManager';
import SiteContentManager from '@/components/SiteContentManager';
import SettingsManager from '@/components/SettingsManager';
import CustomDomainManager from '@/components/CustomDomainManager';
import SettingsSections from '@/components/SettingsSections';

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { slug } = await params;
  // Which section to show is decided by the sidebar, via the URL.
  const { section } = await searchParams;
  const { business, supabase } = await requireStaffSession(slug);

  let [{ data: rules }, { data: bizRow }] = await Promise.all([
    supabase
      .from('booking_rules')
      .select('webhook_url, buffer_minutes, max_advance_days, cancellation_window_hours, require_payment, deposit_percentage')
      .eq('business_id', business.id)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select(
        'about_text, gallery_urls, contact_phone, contact_email, instagram_url, facebook_url, show_about, show_gallery, show_contact, paystack_public_key, paystack_secret_key, custom_domain'
      )
      .eq('id', business.id)
      .single(),
  ]);

  // Same reasoning as the booking route: before the payments migration
  // runs, the combined selects above fail as a whole unit and silently
  // return null - which would make this page render every real,
  // already-saved booking-rule/site-content value as if it were unset,
  // and a normal "Save" click would then overwrite it with the reset
  // default. Falls back to the pre-payments column set so existing data
  // stays visible (and safe from being accidentally wiped) in the meantime.
  if (rules === null) {
    const fallback = await supabase
      .from('booking_rules')
      .select('webhook_url, buffer_minutes, max_advance_days, cancellation_window_hours')
      .eq('business_id', business.id)
      .maybeSingle();
    if (fallback.data) rules = { ...fallback.data, require_payment: false, deposit_percentage: null };
  }
  if (bizRow === null) {
    const fallback = await supabase
      .from('businesses')
      .select('about_text, gallery_urls, contact_phone, contact_email, instagram_url, facebook_url, show_about, show_gallery, show_contact')
      .eq('id', business.id)
      .single();
    if (fallback.data) bizRow = { ...fallback.data, paystack_public_key: null, paystack_secret_key: null, custom_domain: null };
  }

  // If even the fallback came back empty, the forms below will render
  // every field at its default - and a Save from that state would write
  // those defaults over whatever is actually stored. Warn rather than let
  // someone silently wipe their own settings.
  const loadFailed = rules === null || bizRow === null;

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Configure
        </div>
        <h1 className="font-display text-h1 text-ink">Settings</h1>
        <p className="text-ink-soft text-body-sm mt-1">
          Your branding, your booking rules, payments, and your own domain.
        </p>
      </div>

      {loadFailed && (
        <div role="alert" className="mb-6 rounded-xl bg-error-bg border border-error-border px-4 py-3">
          <p className="text-body-sm text-error">
            We couldn&rsquo;t load your current settings, so the fields below are showing defaults rather than what
            you have saved. Refresh before saving - saving now would overwrite your real settings.
          </p>
        </div>
      )}

      <SettingsSections
        active={section}
        sections={[
          {
            key: 'profile',
            label: 'Business profile',
            description: 'Your name, logo, colour and cover photo, as customers see them.',
            content: (
              <BusinessProfileManager
                slug={slug}
                businessId={business.id}
                initialName={business.name}
                initialLogoUrl={business.logo_url}
                initialAccentColor={business.accent_color}
                initialCoverImageUrl={business.cover_image_url}
                initialDescription={business.description}
              />
            ),
          },
          {
            key: 'content',
            label: 'Website content',
            description: 'Your About page, gallery and contact details, and which of them show.',
            content: (
              <SiteContentManager
                slug={slug}
                businessId={business.id}
                initialAboutText={bizRow?.about_text ?? null}
                initialGalleryUrls={bizRow?.gallery_urls ?? null}
                initialContactPhone={bizRow?.contact_phone ?? null}
                initialContactEmail={bizRow?.contact_email ?? null}
                initialInstagramUrl={bizRow?.instagram_url ?? null}
                initialFacebookUrl={bizRow?.facebook_url ?? null}
                initialShowAbout={bizRow?.show_about ?? true}
                initialShowGallery={bizRow?.show_gallery ?? true}
                initialShowContact={bizRow?.show_contact ?? true}
              />
            ),
          },
          {
            key: 'rules',
            label: 'Booking rules and payments',
            description: 'Buffers, how far ahead people can book, cancellation notice, and taking deposits.',
            content: (
              <SettingsManager
                slug={slug}
                businessId={business.id}
                initialWebhookUrl={rules?.webhook_url ?? null}
                initialBufferMinutes={rules?.buffer_minutes ?? 0}
                initialMaxAdvanceDays={rules?.max_advance_days ?? 30}
                initialCancellationWindowHours={rules?.cancellation_window_hours ?? 24}
                initialRequirePayment={rules?.require_payment ?? false}
                initialDepositPercentage={rules?.deposit_percentage ?? null}
                initialPaystackPublicKey={bizRow?.paystack_public_key ?? null}
                initialPaystackSecretKey={bizRow?.paystack_secret_key ?? null}
              />
            ),
          },
          {
            key: 'domain',
            label: 'Custom domain',
            description: 'Use your own web address instead of ours for your public pages.',
            content: <CustomDomainManager businessId={business.id} initialCustomDomain={bizRow?.custom_domain ?? null} />,
          },
        ]}
      />
    </div>
  );
}
