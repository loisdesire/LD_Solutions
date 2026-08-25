import { requireStaffSession } from '@/lib/requireStaffSession';
import BotIntegrationsSettings from '@/components/BotIntegrationsSettings';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Channels' };

// Split out of Settings - connection status for the channels your AI
// receptionist actually answers on is core product functionality, not
// a buried setting, and it's something worth checking far more often
// than you'd ever touch a cancellation policy.
export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Connecting/disconnecting Telegram, WhatsApp, and Messenger means
  // handling real bot credentials - the same risk class as a payment key,
  // so this is owner-only too.
  const { business, supabase } = await requireStaffSession(slug, { requireOwner: true });

  let { data: bizRow, error: bizError } = await supabase
    .from('businesses')
    .select(
      'telegram_bot_username, whatsapp_display_number, messenger_page_name, telegram_last_active_at, whatsapp_last_active_at, messenger_last_active_at'
    )
    .eq('id', business.id)
    .single();

  // 42703 = the last-active-timestamp migration hasn't run yet - the
  // combined select fails as one unit, so fall back to the columns that
  // definitely exist rather than showing every channel as disconnected.
  if (bizError?.code === '42703') {
    const fallback = await supabase
      .from('businesses')
      .select('telegram_bot_username, whatsapp_display_number, messenger_page_name')
      .eq('id', business.id)
      .single();
    bizRow = fallback.data
      ? { ...fallback.data, telegram_last_active_at: null, whatsapp_last_active_at: null, messenger_last_active_at: null }
      : null;
    bizError = fallback.error;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Automate
        </div>
        <h1 className="font-display text-h1 text-ink">Channels</h1>
        <p className="text-ink-soft text-body-sm mt-1">
          Where customers can reach your AI receptionist.
        </p>
      </div>

      {/* Without this, a failed read renders every channel as
          "not connected" - the most misleading possible state on this
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
        telegramLastActiveAt={bizRow?.telegram_last_active_at ?? null}
        whatsappLastActiveAt={bizRow?.whatsapp_last_active_at ?? null}
        messengerLastActiveAt={bizRow?.messenger_last_active_at ?? null}
      />
    </div>
  );
}
