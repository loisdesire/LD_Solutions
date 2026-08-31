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

// Fired from every place a booking becomes CONFIRMED (web checkout,
// chat-channel booking, chat-channel payment webhook) - never on a
// pending_payment hold, since nothing is actually booked yet at that point.
// Sends to every device any staff member at this business has enabled
// notifications on (components/NotificationBell.tsx), not just the owner.
export async function notifyStaffOfNewBooking(
  businessId: string,
  payload: { customerName: string; serviceName: string; whenLabel: string }
) {
  if (!configured) return;

  const [{ data: subs }, { data: business }] = await Promise.all([
    supabaseAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('business_id', businessId),
    supabaseAdmin.from('businesses').select('slug').eq('id', businessId).maybeSingle(),
  ]);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify({
    title: `New booking: ${payload.customerName}`,
    body: `${payload.serviceName} · ${payload.whenLabel}`,
    url: business?.slug ? `/${business.slug}/admin` : '/',
    tag: 'vanova-new-booking',
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = the browser or OS has permanently invalidated this
        // subscription (uninstalled, permission revoked, storage wiped) -
        // clean it up so future bookings don't keep paying the round trip
        // to an endpoint that will never succeed again.
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          logError('pushNotify:send-failed', err, { businessId, subscriptionId: sub.id });
        }
      }
    })
  );
}
