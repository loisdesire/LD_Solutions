import { requireStaffSession } from '@/lib/requireStaffSession';
import BusinessProfileManager from '@/components/BusinessProfileManager';
import SettingsManager from '@/components/SettingsManager';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const { data: rules } = await supabase
    .from('booking_rules')
    .select('webhook_url, buffer_minutes, max_advance_days, cancellation_window_hours')
    .eq('business_id', business.id)
    .maybeSingle();

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
        <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-5 sm:gap-10 py-7 border-b border-line">
          <div>
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
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-5 sm:gap-10 py-7">
          <div>
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
      </div>
    </div>
  );
}
