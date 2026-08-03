import { requireStaffSession } from '@/lib/requireStaffSession';
import BusinessProfileManager from '@/components/BusinessProfileManager';
import SiteContentManager from '@/components/SiteContentManager';
import SettingsManager from '@/components/SettingsManager';
import BotIntegrationsSettings from '@/components/BotIntegrationsSettings';
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

  const [{ data: rules }, { data: bizRow }] = await Promise.all([
    supabase
      .from('booking_rules')
      .select('webhook_url, buffer_minutes, max_advance_days, cancellation_window_hours')
      .eq('business_id', business.id)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select(
        'telegram_bot_username, whatsapp_display_number, messenger_page_name, about_text, gallery_urls, contact_phone, contact_email, instagram_url, facebook_url, show_about, show_gallery, show_contact'
      )
      .eq('id', business.id)
      .single(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Configure
        </div>
        <h1 className="font-display text-[26px] text-ink">Settings</h1>
        <p className="text-ink-soft text-[13.5px] mt-1">
          Make this feel like your business.
        </p>
      </div>

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
          color="var(--progress)"
          icon={
            <svg {...iconProps}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 15l4.5-4.5a1.5 1.5 0 012 0L15 15" />
              <circle cx="15.5" cy="8.5" r="1.5" />
            </svg>
          }
        >
          <SiteContentManager
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
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="AI booking assistant"
          description="Let customers check availability and book straight from a chat."
          color="var(--accent)"
          icon={
            <svg {...iconProps}>
              <path d="M4 4h16v12H8l-4 4V4z" />
              <path d="M8 9h8M8 12h5" />
            </svg>
          }
        >
          <BotIntegrationsSettings
            slug={slug}
            initialTelegramUsername={bizRow?.telegram_bot_username ?? null}
            initialWhatsappNumber={bizRow?.whatsapp_display_number ?? null}
            initialMessengerPageName={bizRow?.messenger_page_name ?? null}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}
