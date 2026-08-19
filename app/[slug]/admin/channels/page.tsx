import { requireStaffSession } from '@/lib/requireStaffSession';
import BotIntegrationsSettings from '@/components/BotIntegrationsSettings';

// Split out of Settings — connection status for the channels your AI
// receptionist actually answers on is core product functionality, not
// a buried setting, and it's something worth checking far more often
// than you'd ever touch a cancellation policy.
export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const { data: bizRow, error: bizError } = await supabase
    .from('businesses')
    .select('telegram_bot_username, whatsapp_display_number, messenger_page_name')
    .eq('id', business.id)
    .single();

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage
        </div>
        <h1 className="font-display text-h1 text-ink">Channels</h1>
        <p className="text-ink-soft text-body-sm mt-1">
          Where customers can reach your AI receptionist.
        </p>
      </div>

      {/* Without this, a failed read renders every channel as
          "not connected" — the most misleading possible state on this
          page, since an owner could reasonably reconnect (or panic)
          based on it. */}
      {bizError && (
        <div role="alert" className="mb-6 rounded-xl bg-error-bg border border-error-border px-4 py-3">
          <p className="text-body-sm text-error">
            We couldn&rsquo;t load your channel connections just now, so the statuses below may be wrong. Refresh
            before changing anything.
          </p>
        </div>
      )}

      <BotIntegrationsSettings
        slug={slug}
        initialTelegramUsername={bizRow?.telegram_bot_username ?? null}
        initialWhatsappNumber={bizRow?.whatsapp_display_number ?? null}
        initialMessengerPageName={bizRow?.messenger_page_name ?? null}
      />
    </div>
  );
}
