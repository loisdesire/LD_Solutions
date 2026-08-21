import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage, sendWhatsappMessage, sendMessengerMessage } from './channelSend';
import { sendEmail } from './email';
import { renderEmail } from './emailTemplate';
import { parseContact } from './contact';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extracted from what was originally only inside the reminders cron route —
// "message a customer through whichever channel they actually booked
// through, falling back to email if that channel's since been
// disconnected" is exactly the same problem the reschedule feature has, so
// this is now the one shared implementation both call, rather than a
// second copy of the same channel-routing logic silently drifting from
// the original over time.
export type NotifyBusinessCreds = {
  telegram_bot_token: string | null;
  whatsapp_access_token: string | null;
  whatsapp_phone_number_id: string | null;
  messenger_access_token: string | null;
  // Optional so existing callers that only pass credentials still compile;
  // the email falls back to unbranded-but-correct when they're absent.
  name?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
};

export type NotifyCustomerContact = {
  customer_phone: string | null;
  customer_telegram_username?: string | null;
  customer_email: string | null;
};

// Returns true only if something was actually sent — a rejected/failed
// send of any kind should be treated as a failure by the caller, never as
// silently "handled."
export async function notifyCustomer(
  business: NotifyBusinessCreds,
  customer: NotifyCustomerContact,
  text: string,
  emailSubject: string,
  logContext: string,
  meta?: Record<string, unknown>
): Promise<boolean> {
  const { channel } = customer.customer_phone
    ? parseContact(customer.customer_phone, customer.customer_telegram_username ?? undefined)
    : { channel: 'direct' as const };

  if (channel === 'telegram' && business.telegram_bot_token) {
    const chatId = customer.customer_phone!.replace(/^telegram:/, '');
    return sendTelegramMessage(business.telegram_bot_token, chatId, text);
  }
  if (channel === 'whatsapp' && business.whatsapp_access_token && business.whatsapp_phone_number_id) {
    return sendWhatsappMessage(business.whatsapp_access_token, business.whatsapp_phone_number_id, customer.customer_phone!, text);
  }
  if (channel === 'messenger' && business.messenger_access_token) {
    const psid = customer.customer_phone!.replace(/^messenger:/, '');
    return sendMessengerMessage(business.messenger_access_token, psid, text);
  }
  if (customer.customer_email) {
    // sendEmail already no-ops (returns false) when RESEND_API_KEY isn't
    // configured, so this can be called unconditionally.
    // The bot channels take plain text; email gets the same words wrapped
    // in the shared branded template rather than a bare <p>.
    return sendEmail(
      {
        to: customer.customer_email,
        subject: emailSubject,
        html: renderEmail({
          businessName: business.name ?? emailSubject,
          accentColor: business.accent_color,
          logoUrl: business.logo_url,
          preheader: text.slice(0, 140),
          heading: emailSubject,
          intro: text,
        }),
      },
      logContext,
      meta
    );
  }
  return false;
}

// Single place that knows how to safely fetch a business's channel
// credentials for notifyCustomer — `whatsapp_access_token` and
// `whatsapp_business_account_id` are live-verified missing on the current
// database (documented in schema.sql as migrated, but never actually
// applied — see the note on those two `alter table` lines), so a combined
// select naming whatsapp_access_token fails as a whole unit and silently
// takes Telegram/Messenger/email down with it. Falls back to the columns
// that do exist so every OTHER channel keeps working regardless of
// WhatsApp's state; WhatsApp itself just correctly resolves to
// "not connected" until that migration runs.
export async function getNotifyCreds(businessId: string): Promise<NotifyBusinessCreds & { name: string | null }> {
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('name, accent_color, logo_url, telegram_bot_token, whatsapp_access_token, whatsapp_phone_number_id, messenger_access_token')
    .eq('id', businessId)
    .maybeSingle();

  if (error?.code === '42703') {
    const fallback = await supabaseAdmin
      .from('businesses')
      .select('name, accent_color, logo_url, telegram_bot_token, messenger_access_token')
      .eq('id', businessId)
      .maybeSingle();
    return {
      name: fallback.data?.name ?? null,
      accent_color: fallback.data?.accent_color ?? null,
      logo_url: fallback.data?.logo_url ?? null,
      telegram_bot_token: fallback.data?.telegram_bot_token ?? null,
      messenger_access_token: fallback.data?.messenger_access_token ?? null,
      whatsapp_access_token: null,
      whatsapp_phone_number_id: null,
    };
  }

  return (
    data ?? {
      name: null,
      accent_color: null,
      logo_url: null,
      telegram_bot_token: null,
      whatsapp_access_token: null,
      whatsapp_phone_number_id: null,
      messenger_access_token: null,
    }
  );
}
