import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GRAPH = 'https://graph.facebook.com/v21.0';

// POST /api/settings/whatsapp - completes Meta's Embedded Signup flow. The
// frontend (BotIntegrationsSettings) runs the FB.login popup itself and
// hands us the resulting authorization `code` plus the wabaId/phoneNumberId
// captured from the WA_EMBEDDED_SIGNUP postMessage event; everything from
// here on is server-side because it needs the App Secret, which must never
// reach the browser.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`settings-whatsapp:${getClientIp(req)}`, 10, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, code, wabaId, phoneNumberId } = await req.json();
  if (!slug || !code || !wabaId || !phoneNumberId) {
    return NextResponse.json({ error: 'Missing signup data - please try connecting again.' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  // The code from FB.login (embedded-signup mode) is exchanged with no
  // redirect_uri - that's specific to this JS SDK flow, unlike a normal
  // OAuth redirect-based exchange.
  const shortLived = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&code=${code}`
  )
    .then((r) => r.json())
    .catch(() => null);

  if (!shortLived?.access_token) {
    logError('api/settings/whatsapp:code-exchange', new Error(shortLived?.error?.message || 'code exchange failed'), {
      businessId: business.id,
    });
    return NextResponse.json({ error: 'Could not verify with Meta. Please try connecting again.' }, { status: 502 });
  }

  // Short-lived tokens expire in ~1-2 hours; exchange for a long-lived one
  // (~60 days) so the bot can keep sending without the owner re-connecting
  // constantly.
  const longLived = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${shortLived.access_token}`
  )
    .then((r) => r.json())
    .catch(() => null);

  const accessToken = longLived?.access_token ?? shortLived.access_token;

  // Fetch the human-readable number for display, and subscribe our app to
  // this WABA's webhooks - without this, Meta never sends inbound messages
  // for this business's number to /api/meta/webhook at all.
  const [phoneRes, subscribeRes] = await Promise.all([
    fetch(`${GRAPH}/${phoneNumberId}?fields=display_phone_number`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .catch(() => null),
    fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .catch(() => null),
  ]);

  if (!subscribeRes?.success) {
    logError('api/settings/whatsapp:subscribe', new Error(subscribeRes?.error?.message || 'subscribe failed'), {
      businessId: business.id,
      wabaId,
    });
    return NextResponse.json(
      { error: 'Connected to Meta but could not subscribe to messages. Please try again.' },
      { status: 502 }
    );
  }

  const displayNumber = phoneRes?.display_phone_number ?? null;

  const { error: updateError } = await supabaseAdmin
    .from('businesses')
    .update({
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_business_account_id: wabaId,
      whatsapp_display_number: displayNumber,
      whatsapp_access_token: accessToken,
    })
    .eq('id', business.id);

  if (updateError) {
    logError('api/settings/whatsapp:save', updateError, { businessId: business.id });
    if ((updateError as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'This number is already connected to another business.' }, { status: 409 });
    }
    // 42703 = whatsapp_access_token / whatsapp_business_account_id are
    // missing from the live database - live-verified (documented in
    // schema.sql as migrated, but never actually applied). Worth a
    // distinct message rather than the generic one below: this isn't a
    // transient failure a retry would fix.
    if ((updateError as { code?: string }).code === '42703') {
      return NextResponse.json(
        { error: "WhatsApp isn't fully set up on this deployment yet - a database migration is still pending. Contact support." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Connected to Meta but failed to save. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ connected: true, displayNumber });
}

export async function DELETE(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  const { error: deleteError } = await supabaseAdmin
    .from('businesses')
    .update({
      whatsapp_phone_number_id: null,
      whatsapp_business_account_id: null,
      whatsapp_display_number: null,
      whatsapp_access_token: null,
    })
    .eq('id', business.id);

  // Previously unchecked - a failed disconnect silently reported success,
  // leaving the business looking connected in the DB while the owner
  // believed they'd disconnected. whatsapp_business_account_id/
  // whatsapp_access_token being absent (see the POST handler above) would
  // hit exactly this.
  if (deleteError) {
    logError('api/settings/whatsapp:disconnect', deleteError, { businessId: business.id });
    return NextResponse.json({ error: 'Failed to disconnect. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}
