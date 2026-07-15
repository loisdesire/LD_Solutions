import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { SITE_URL } from '@/lib/site';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same staff-membership check as requireStaffSession, but returns JSON
// instead of redirecting — requireStaffSession is built for page rendering
// (next/navigation's redirect()/notFound()), which doesn't make sense for a
// fetch()-consumed API route.
async function authorize(slug: string) {
  const data = await getBusinessBySlug(slug);
  if (!data) return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };

  const { data: staffRow } = await supabase
    .from('staff')
    .select('id')
    .eq('business_id', data.business.id)
    .eq('auth_id', user.id)
    .maybeSingle();
  if (!staffRow) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };

  return { business: data.business };
}

// POST /api/settings/telegram — a business owner pastes their own BotFather
// token; we validate it's real, register our webhook against it directly
// via Telegram's API (no manual console step needed, unlike Twilio), and
// save it. Fully self-serve, unlike WhatsApp's semi-manual flow below.
export async function POST(req: NextRequest) {
  if (!rateLimit(`settings-telegram:${getClientIp(req)}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, botToken } = await req.json();
  if (!slug || typeof botToken !== 'string' || !botToken.trim()) {
    return NextResponse.json({ error: 'Missing slug or bot token' }, { status: 400 });
  }

  const auth = await authorize(slug);
  if (auth.error) return auth.error;
  const { business } = auth;

  const token = botToken.trim();

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`).catch(() => null);
  const me = meRes ? await meRes.json().catch(() => null) : null;
  if (!me?.ok) {
    return NextResponse.json(
      { error: "That doesn't look like a valid bot token — double check it from BotFather." },
      { status: 400 }
    );
  }

  const webhookRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `${SITE_URL}/api/telegram/webhook/${token}`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    }),
  }).catch(() => null);
  const webhookResult = webhookRes ? await webhookRes.json().catch(() => null) : null;

  if (!webhookResult?.ok) {
    logError('api/settings/telegram:setWebhook', new Error(webhookResult?.description || 'setWebhook failed'), {
      businessId: business.id,
    });
    return NextResponse.json({ error: 'Could not register the webhook with Telegram. Please try again.' }, { status: 502 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('businesses')
    .update({ telegram_bot_token: token, telegram_bot_username: me.result.username })
    .eq('id', business.id);

  if (updateError) {
    logError('api/settings/telegram:save', updateError, { businessId: business.id });
    if ((updateError as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'This bot is already connected to another business.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Connected to Telegram but failed to save. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ connected: true, botUsername: me.result.username as string });
}

export async function DELETE(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await authorize(slug);
  if (auth.error) return auth.error;
  const { business } = auth;

  const { data: current } = await supabaseAdmin
    .from('businesses')
    .select('telegram_bot_token')
    .eq('id', business.id)
    .single();

  if (current?.telegram_bot_token) {
    await fetch(`https://api.telegram.org/bot${current.telegram_bot_token}/deleteWebhook`).catch(() => {});
  }

  await supabaseAdmin
    .from('businesses')
    .update({ telegram_bot_token: null, telegram_bot_username: null })
    .eq('id', business.id);

  return NextResponse.json({ disconnected: true });
}
