import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { getBusinessByWhatsappNumber } from '@/lib/whatsappTools';
import { runWhatsappAgent } from '@/lib/whatsappAgent';
import { rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

function twiml(message: string) {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

function xmlResponse(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/xml' } });
}

// POST /api/whatsapp/webhook — Twilio hits this for every inbound WhatsApp
// message. All Twilio-specific concerns (signature verification, form
// parsing, TwiML replies) live only here; the assistant logic is in
// lib/whatsappAgent.ts and database access in lib/whatsappTools.ts, so
// neither of those has to know Twilio exists.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = req.headers.get('x-twilio-signature') ?? '';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? '';
  const url = `${proto}://${host}${req.nextUrl.pathname}`;

  const validSignature = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN!, signature, url, params);

  if (!validSignature) {
    logError('api/whatsapp/webhook:signature', new Error('Invalid Twilio signature'), { url });
    return new NextResponse('Forbidden', { status: 403 });
  }

  const from = params.From; // e.g. 'whatsapp:+2348012345678' — the customer
  const to = params.To; // the business's connected WhatsApp number
  const body = (params.Body ?? '').trim();

  if (!from || !to || !body) {
    return xmlResponse(twiml("Sorry, I didn't catch that. Could you try again?"));
  }

  if (!rateLimit(`whatsapp:${from}`, 20, 5 * 60_000)) {
    return xmlResponse(twiml("You're sending messages a little fast, please wait a moment and try again."));
  }

  const business = await getBusinessByWhatsappNumber(to);
  if (!business) {
    logError('api/whatsapp/webhook:business-not-found', new Error('No business for WhatsApp number'), { to });
    return xmlResponse(twiml('This WhatsApp number is not connected to a business yet.'));
  }

  try {
    const reply = await runWhatsappAgent({
      businessId: business.id,
      customerPhone: from,
      incomingText: body,
    });
    return xmlResponse(twiml(reply));
  } catch (err) {
    logError('api/whatsapp/webhook:agent', err, { businessId: business.id, from });
    return xmlResponse(twiml('Sorry, something went wrong on our end. Please try again shortly.'));
  }
}
