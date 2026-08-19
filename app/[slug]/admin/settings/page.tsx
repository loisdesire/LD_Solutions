import { requireStaffSession } from '@/lib/requireStaffSession';
import BusinessProfileManager from '@/components/BusinessProfileManager';
import SiteContentManager from '@/components/SiteContentManager';
import SettingsManager from '@/components/SettingsManager';
import CustomDomainManager from '@/components/CustomDomainManager';
import CollapsibleSection from '@/components/CollapsibleSection';

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
  // return null — which would make this page render every real,
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
  // every field at its default — and a Save from that state would write
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
          Make this feel like your business.
        </p>
      </div>

      {loadFailed && (
        <div role="alert" className="mb-6 rounded-xl bg-error-bg border border-error-border px-4 py-3">
          <p className="text-body-sm text-error">
            We couldn&rsquo;t load your current settings, so the fields below are showing defaults rather than what
            you have saved. Refresh before saving — saving now would overwrite your real settings.
          </p>
        </div>
      )}

      {/* Channel connections used to live here as a fourth item — moved to
          its own page, since checking whether WhatsApp is still connected
          is something you'd do far more often than touch a cancellation
          policy, and it deserves its own spot in the sidebar rather than
          being the buried last item in Settings. */}
      <div className="border-t border-line">
        <CollapsibleSection
          title="Business profile"
          description="Your name, logo, and color appear on your booking page."
          color="var(--accent)"
          icon={
            <svg {...iconProps}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
            </svg>
          }
          defaultOpen
        >
          <BusinessProfileManager
            slug={slug}
            businessId={business.id}
            initialName={business.name}
            initialLogoUrl={business.logo_url}
            initialAccentColor={business.accent_color}
            initialCoverImageUrl={business.cover_image_url}
            initialDescription={business.description}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Website content"
          description="About, gallery, and contact info shown on your booking page."
          color="var(--tertiary)"
          icon={
            <svg {...iconProps}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 15l4.5-4.5a1.5 1.5 0 012 0L15 15" />
              <circle cx="15.5" cy="8.5" r="1.5" />
            </svg>
          }
        >
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
        </CollapsibleSection>

        <CollapsibleSection
          title="Booking rules"
          description="Keep your schedule sane with buffers and limits."
          color="var(--tertiary)"
          icon={
            <svg {...iconProps}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
        >
          <SettingsManager
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
        </CollapsibleSection>

        <CollapsibleSection
          title="Custom domain"
          description="Serve your booking page from your own domain instead of the platform's."
          color="var(--accent)"
          icon={
            <svg {...iconProps}>
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.7 4 6 4 9s-1.5 6.3-4 9c-2.5-2.7-4-6-4-9s1.5-6.3 4-9z" />
            </svg>
          }
        >
          <CustomDomainManager businessId={business.id} initialCustomDomain={bizRow?.custom_domain ?? null} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
