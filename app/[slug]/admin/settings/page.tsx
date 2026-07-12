import { requireStaffSession } from '@/lib/requireStaffSession';
import AdminNav from '@/components/AdminNav';
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
    <main className="min-h-screen bg-canvas bg-grid">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 animate-rise">
        <AdminNav slug={slug} />

        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Settings
          </h1>
          <p className="text-muted mt-3">
            Your business profile and how bookings behave.
          </p>
        </header>

        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Profile
            </h2>
            <BusinessProfileManager
              businessId={business.id}
              initialName={business.name}
              initialLogoUrl={business.logo_url}
              initialAccentColor={business.accent_color}
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Booking rules
            </h2>
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
    </main>
  );
}
