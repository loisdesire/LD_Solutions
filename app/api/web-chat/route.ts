import { NextRequest, NextResponse } from 'next/server';
import { loadConversation } from '@/lib/whatsappTools';
import { runWhatsappAgent } from '@/lib/whatsappAgent';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

// GET /api/web-chat?businessId=&sessionId= — hydrates the widget with
// existing history when a returning visitor reopens it, same conversation
// the AI already has from any earlier turns on this session.
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!businessId || !sessionId) {
    return NextResponse.json({ error: 'Missing businessId or sessionId' }, { status: 400 });
  }

  const messages = await loadConversation(businessId, `web:${sessionId}`);
  return NextResponse.json({ messages });
}

// POST /api/web-chat — the website's own chat widget, talking to the exact
// same agent as WhatsApp/Telegram/Messenger (lib/whatsappAgent.ts doesn't
// know or care which channel called it). No provider webhook involved here
// at all: the browser calls this directly and gets the reply back in the
// same request, since there's no external messaging platform in the loop —
// `web:<sessionId>` is just this channel's version of the same opaque
// per-channel customer identifier the other channels already use.
export async function POST(req: NextRequest) {
  if (!rateLimit(`web-chat:${getClientIp(req)}`, 20, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many messages, please slow down.' }, { status: 429 });
  }

  const { businessId, sessionId, message } = await req.json();
  if (!businessId || !sessionId || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Missing businessId, sessionId, or message' }, { status: 400 });
  }

  try {
    const reply = await runWhatsappAgent({
      businessId,
      customerPhone: `web:${sessionId}`,
      incomingText: message.trim(),
    });
    return NextResponse.json({ reply });
  } catch (err) {
    logError('api/web-chat:agent', err, { businessId, sessionId });
    return NextResponse.json(
      { reply: 'Sorry, something went wrong on our end. Please try again shortly.' },
      { status: 200 }
    );
  }
}
