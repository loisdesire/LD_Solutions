import { NextRequest, NextResponse } from 'next/server';
import { getBusinessByTelegramToken } from '@/lib/whatsappTools';
import { runWhatsappAgent } from '@/lib/whatsappAgent';
import { rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
  };
};

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// POST /api/telegram/webhook/[token] — Telegram calls this per-bot URL for
// every update (each business's bot is registered against its own URL, so
// the token in the path IS the routing signal). Unlike Twilio's synchronous
// TwiML reply, Telegram requires actively calling sendMessage to reply; the
// response to this webhook itself is just an ack. All Telegram-specific
// concerns live here — the shared agent (lib/whatsappAgent.ts) and booking
// logic (lib/whatsappTools.ts) don't know this channel exists.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    logError('api/telegram/webhook:secret', new Error('Invalid Telegram webhook secret'));
    return new NextResponse('Forbidden', { status: 403 });
  }

  const update: TelegramUpdate = await req.json();
  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim();

  // Ack with 200 even when there's nothing actionable (non-text messages,
  // edited messages, etc.) — a non-200 makes Telegram retry the same update.
  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  if (!rateLimit(`telegram:${chatId}`, 20, 5 * 60_000)) {
    await sendTelegramMessage(token, chatId, "You're sending messages a little fast, please wait a moment and try again.");
    return NextResponse.json({ ok: true });
  }

  const business = await getBusinessByTelegramToken(token);
  if (!business) {
    logError('api/telegram/webhook:business-not-found', new Error('No business for Telegram bot token'));
    return NextResponse.json({ ok: true });
  }

  try {
    const reply = await runWhatsappAgent({
      businessId: business.id,
      customerPhone: `telegram:${chatId}`,
      incomingText: text,
    });
    await sendTelegramMessage(token, chatId, reply);
  } catch (err) {
    logError('api/telegram/webhook:agent', err, { businessId: business.id, chatId });
    await sendTelegramMessage(token, chatId, 'Sorry, something went wrong on our end. Please try again shortly.');
  }

  return NextResponse.json({ ok: true });
}
