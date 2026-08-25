import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBusinessByMessengerPageId, markChannelActive } from '@/lib/whatsappTools';
import { runWhatsappAgent } from '@/lib/whatsappAgent';
import { sendMessengerMessage } from '@/lib/channelSend';
import { rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

type MessengerWebhookPayload = {
  entry?: Array<{
    id?: string; // Page ID
    messaging?: Array<{
      sender?: { id?: string };
      message?: { text?: string; is_echo?: boolean };
    }>;
  }>;
};

// GET /api/messenger/webhook - same verification handshake as the WhatsApp
// route, and deliberately reuses the same app-level verify token/secret
// (both are properties of the Meta App, not specific to the WhatsApp
// product) rather than minting new ones per channel.
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST /api/messenger/webhook - one shared URL for every Page connected to
// this Meta App, same shape as the WhatsApp route: identify the business by
// the id in the payload (here, the Page ID), reuse the same channel-
// agnostic agent, reply through the Send API. Instagram messaging can be
// added later as its own thin route the same way, since it shares this
// same Page-based connection model.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signature = req.headers.get('x-hub-signature-256');
  const expected =
    'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(rawBody).digest('hex');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    logError('api/messenger/webhook:signature', new Error('Invalid Messenger webhook signature'));
    return new NextResponse('Forbidden', { status: 403 });
  }

  const payload: MessengerWebhookPayload = JSON.parse(rawBody);
  const entry = payload.entry?.[0];
  const event = entry?.messaging?.[0];
  const pageId = entry?.id;
  const psid = event?.sender?.id;
  const text = event?.message?.text?.trim();

  // Ack with 200 for anything not a plain inbound text message - delivery
  // receipts, read events, and our own echoed sends (is_echo) all come
  // through this same webhook and aren't actionable.
  if (!pageId || !psid || !text || event?.message?.is_echo) {
    return NextResponse.json({ ok: true });
  }

  const customerId = `messenger:${psid}`;

  const business = await getBusinessByMessengerPageId(pageId);
  if (!business || !business.messenger_access_token) {
    logError('api/messenger/webhook:business-not-found', new Error('No business/token for Page ID'), { pageId });
    return NextResponse.json({ ok: true });
  }
  const accessToken = business.messenger_access_token;
  // Not awaited - never let a dashboard-only timestamp affect the reply.
  markChannelActive(business.id, 'messenger');

  if (!rateLimit(`messenger:${psid}`, 20, 5 * 60_000)) {
    await sendMessengerMessage(accessToken, psid, "You're sending messages a little fast, please wait a moment and try again.");
    return NextResponse.json({ ok: true });
  }

  try {
    const reply = await runWhatsappAgent({
      businessId: business.id,
      customerPhone: customerId,
      incomingText: text,
    });
    await sendMessengerMessage(accessToken, psid, reply);
  } catch (err) {
    logError('api/messenger/webhook:agent', err, { businessId: business.id, psid });
    await sendMessengerMessage(accessToken, psid, 'Sorry, something went wrong on our end. Please try again shortly.');
  }

  return NextResponse.json({ ok: true });
}
