import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/settings/messenger - a business owner pastes a Page Access
// Token generated from their own Meta App dashboard (Messenger > Settings
// > Access Tokens - no OAuth popup needed, unlike WhatsApp's Embedded
// Signup). We validate it against the Page, then subscribe our webhook to
// that page's messaging events directly via the Graph API, the same way
// the Telegram flow self-registers its own webhook - fully self-serve
// once you have the token.
export async function POST(req: NextRequest) {
  if (!rateLimit(`settings-messenger:${getClientIp(req)}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, pageAccessToken } = await req.json();
  if (!slug || typeof pageAccessToken !== 'string' || !pageAccessToken.trim()) {
    return NextResponse.json({ error: 'Missing slug or page access token' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(slug);
  if (auth.error) return auth.error;
  const { business } = auth;

  const token = pageAccessToken.trim();

  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`
  ).catch(() => null);
  const me = meRes ? await meRes.json().catch(() => null) : null;
  if (!me?.id) {
    return NextResponse.json(
      { error: "That doesn't look like a valid Page Access Token - generate one from your Meta App's Messenger settings." },
      { status: 400 }
    );
  }

  const subscribeRes = await fetch(
    `https://graph.facebook.com/v21.0/${me.id}/subscribed_apps?subscribed_fields=messages&access_token=${encodeURIComponent(token)}`,
    { method: 'POST' }
  ).catch(() => null);
  const subscribeResult = subscribeRes ? await subscribeRes.json().catch(() => null) : null;

  if (!subscribeResult?.success) {
    logError('api/settings/messenger:subscribe', new Error(JSON.stringify(subscribeResult)), {
      businessId: business.id,
      pageId: me.id,
    });
    return NextResponse.json({ error: 'Could not subscribe the webhook to this Page. Please try again.' }, { status: 502 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('businesses')
    .update({ messenger_page_id: me.id, messenger_access_token: token, messenger_page_name: me.name })
    .eq('id', business.id);

  if (updateError) {
    logError('api/settings/messenger:save', updateError, { businessId: business.id });
    if ((updateError as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'This Page is already connected to another business.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Connected but failed to save. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ connected: true, pageName: me.name as string });
}

export async function DELETE(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(slug, 'id, messenger_page_id, messenger_access_token');
  if (auth.error) return auth.error;
  const { business } = auth;

  if (business.messenger_page_id && business.messenger_access_token) {
    await fetch(
      `https://graph.facebook.com/v21.0/${business.messenger_page_id}/subscribed_apps?access_token=${encodeURIComponent(business.messenger_access_token)}`,
      { method: 'DELETE' }
    ).catch(() => {});
  }

  await supabaseAdmin
    .from('businesses')
    .update({ messenger_page_id: null, messenger_access_token: null, messenger_page_name: null })
    .eq('id', business.id);

  return NextResponse.json({ disconnected: true });
}
