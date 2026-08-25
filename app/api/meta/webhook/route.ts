import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBusinessByMetaPhoneNumberId, markChannelActive } from '@/lib/whatsappTools';
import { runWhatsappAgent } from '@/lib/whatsappAgent';
import { sendWhatsappMessage } from '@/lib/channelSend';
import { rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{ from?: string; text?: { body?: string }; type?: string }>;
      };
    }>;
  }>;
};

// GET /api/meta/webhook - Meta's one-time verification handshake when you
// subscribe this URL in the App dashboard. Echo hub.challenge back verbatim
// if the verify token matches, or Meta refuses to save the subscription.
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST /api/meta/webhook - Meta calls this for every inbound message AND
// every delivery-status update, all through ONE shared URL for the whole
// App (unlike Telegram's per-bot URL) - the business is identified by
// matching metadata.phone_number_id against businesses.whatsapp_phone_number_id
// instead. All Meta-specific concerns live here; the shared agent
// (lib/whatsappAgent.ts) and booking logic (lib/whatsappTools.ts) don't
// know this channel exists.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Meta signs the raw request body with the App Secret - verifying this
  // is what proves the request actually came from Meta, not a spoofed call.
  const signature = req.headers.get('x-hub-signature-256');
  const expected =
    'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(rawBody).digest('hex');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    logError('api/meta/webhook:signature', new Error('Invalid Meta webhook signature'));
    return new NextResponse('Forbidden', { status: 403 });
  }

  const payload: MetaWebhookPayload = JSON.parse(rawBody);
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const phoneNumberId = value?.metadata?.phone_number_id;

  // Ack with 200 even when there's nothing actionable (delivery-status
  // updates, non-text messages, etc.) - Meta retries on anything else.
  if (!phoneNumberId || !message || message.type !== 'text' || !message.from || !message.text?.body) {
    return NextResponse.json({ ok: true });
  }

  const from = message.from; // bare digits, no '+' - normalize to this codebase's usual format
  const customerPhone = `whatsapp:+${from}`;
  const text = message.text.body.trim();

  // Each business connects its own number via Embedded Signup, so the
  // access token used to reply is theirs, not a shared platform token -
  // the business lookup has to happen before any reply can be sent at all.
  const business = await getBusinessByMetaPhoneNumberId(phoneNumberId);
  if (!business || !business.whatsapp_access_token) {
    logError('api/meta/webhook:business-not-found', new Error('No business/token for Meta phone_number_id'), {
      phoneNumberId,
    });
    return NextResponse.json({ ok: true });
  }
  const accessToken = business.whatsapp_access_token;
  // Not awaited - never let a dashboard-only timestamp affect the reply.
  markChannelActive(business.id, 'whatsapp');

  if (!rateLimit(`meta-whatsapp:${from}`, 20, 5 * 60_000)) {
    await sendWhatsappMessage(
      accessToken,
      phoneNumberId,
      customerPhone,
      "You're sending messages a little fast, please wait a moment and try again."
    );
    return NextResponse.json({ ok: true });
  }

  try {
    const reply = await runWhatsappAgent({
      businessId: business.id,
      customerPhone,
      incomingText: text,
    });
    await sendWhatsappMessage(accessToken, phoneNumberId, customerPhone, reply);
  } catch (err) {
    logError('api/meta/webhook:agent', err, { businessId: business.id, from });
    await sendWhatsappMessage(
      accessToken,
      phoneNumberId,
      customerPhone,
      'Sorry, something went wrong on our end. Please try again shortly.'
    );
  }

  return NextResponse.json({ ok: true });
}
