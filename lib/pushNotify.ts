import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { logError } from './logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same "just don't configure it" pattern as lib/email.ts's RESEND_API_KEY -
// push works the moment these two env vars exist and silently no-ops until
// then, rather than crashing every booking route that calls it.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails('mailto:support@vanovahub.com', VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

// The actual "send to every device this business has notifications
// enabled on" loop - extracted so a second caller (owner reminders, see
// below) doesn't duplicate the same subscription-fetch, per-device
// send-with-cleanup logic notifyStaffOfNewBooking already had. Returns
// true if it reached at least one device, so a caller with its own
// "did this actually go anywhere" bookkeeping (the reminders cron marks
// each reminder sent regardless, but logs when nothing was reachable) can
// tell the difference from "silently did nothing."
async function sendPushToBusiness(
  businessId: string,
  payload: { title: string; body: string; url: string; tag: string }
): Promise<boolean> {
  if (!configured) return false;

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('business_id', businessId);

  if (!subs || subs.length === 0) return false;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = the browser or OS has permanently invalidated this
        // subscription (uninstalled, permission revoked, storage wiped) -
        // clean it up so future notifications don't keep paying the round
        // trip to an endpoint that will never succeed again.
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          logError('pushNotify:send-failed', err, { businessId, subscriptionId: sub.id });
        }
      }
    })
  );

  return true;
}

// Fired from every place a booking becomes CONFIRMED (web checkout,
// chat-channel booking, chat-channel payment webhook) - never on a
// pending_payment hold, since nothing is actually booked yet at that point.
// Sends to every device any staff member at this business has enabled
// notifications on (components/NotificationBell.tsx), not just the owner.
export async function notifyStaffOfNewBooking(
  businessId: string,
  payload: { customerName: string; serviceName: string; whenLabel: string }
) {
  const { data: business } = await supabaseAdmin.from('businesses').select('slug').eq('id', businessId).maybeSingle();
  await sendPushToBusiness(businessId, {
    title: `New booking: ${payload.customerName}`,
    body: `${payload.serviceName} · ${payload.whenLabel}`,
    url: business?.slug ? `/${business.slug}/admin` : '/',
    tag: 'vanova-new-booking',
  });
}

// Fired by the owner-reminders cron (app/api/cron/send-owner-reminders)
// once a reminder's remind_at has passed. Same reach as a new-booking
// alert - every device any staff member has notifications enabled on, not
// just whoever originally asked for the reminder (staff_id isn't even
// threaded through yet - see lib/manageTools.ts's applyCreateReminder).
export async function notifyStaffOfReminder(businessId: string, message: string): Promise<boolean> {
  const { data: business } = await supabaseAdmin.from('businesses').select('slug').eq('id', businessId).maybeSingle();
  return sendPushToBusiness(businessId, {
    title: 'Reminder',
    body: message,
    url: business?.slug ? `/${business.slug}/admin` : '/',
    tag: 'vanova-owner-reminder',
  });
}
