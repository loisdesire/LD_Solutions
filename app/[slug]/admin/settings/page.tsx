import { requireStaffSession } from '@/lib/requireStaffSession';
import BusinessProfileManager from '@/components/BusinessProfileManager';
import SiteContentManager from '@/components/SiteContentManager';
import SettingsManager from '@/components/SettingsManager';
import BotIntegrationsSettings from '@/components/BotIntegrationsSettings';

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
        'telegram_bot_username, whatsapp_display_number, messenger_page_name, about_text, gallery_urls, contact_phone, contact_email, instagram_url, facebook_url'
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
        <div className="py-7 border-b border-line">
          <div className="mb-5">
            <h2 className="font-display text-[17px]">Business profile</h2>
            <p className="text-ink-soft text-[13px] mt-1.5">
              Your name, logo, and color appear on your booking page.
            </p>
          </div>
          <BusinessProfileManager
            businessId={business.id}
            initialName={business.name}
            initialLogoUrl={business.logo_url}
            initialAccentColor={business.accent_color}
            initialCoverImageUrl={business.cover_image_url}
            initialDescription={business.description}
          />
        </div>

        <div className="py-7 border-b border-line">
          <div className="mb-5">
            <h2 className="font-display text-[17px]">Website content</h2>
            <p className="text-ink-soft text-[13px] mt-1.5">
              About, gallery, and contact info shown on your booking page.
            </p>
          </div>
          <SiteContentManager
            businessId={business.id}
            initialAboutText={bizRow?.about_text ?? null}
            initialGalleryUrls={bizRow?.gallery_urls ?? null}
            initialContactPhone={bizRow?.contact_phone ?? null}
            initialContactEmail={bizRow?.contact_email ?? null}
            initialInstagramUrl={bizRow?.instagram_url ?? null}
            initialFacebookUrl={bizRow?.facebook_url ?? null}
          />
        </div>

        <div className="py-7 border-b border-line">
          <div className="mb-5">
            <h2 className="font-display text-[17px]">Booking rules</h2>
            <p className="text-ink-soft text-[13px] mt-1.5">
              Keep your schedule sane with buffers and limits.
            </p>
          </div>
          <SettingsManager
            businessId={business.id}
            initialWebhookUrl={rules?.webhook_url ?? null}
            initialBufferMinutes={rules?.buffer_minutes ?? 0}
            initialMaxAdvanceDays={rules?.max_advance_days ?? 30}
            initialCancellationWindowHours={rules?.cancellation_window_hours ?? 24}
          />
        </div>

        <div className="py-7">
          <div className="mb-5">
            <h2 className="font-display text-[17px]">AI booking assistant</h2>
            <p className="text-ink-soft text-[13px] mt-1.5">
              Let customers check availability and book straight from a chat.
            </p>
          </div>
          <BotIntegrationsSettings
            slug={slug}
            initialTelegramUsername={bizRow?.telegram_bot_username ?? null}
            initialWhatsappNumber={bizRow?.whatsapp_display_number ?? null}
            initialMessengerPageName={bizRow?.messenger_page_name ?? null}
          />
        </div>
      </div>
    </div>
  );
}
