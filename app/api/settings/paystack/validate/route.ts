import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// POST /api/settings/paystack/validate - checks a Paystack key pair before
// it is saved.
//
// Without this, a wrong or mistyped secret key is only discovered when a
// real customer tries to pay and the booking fails, and test keys are never
// discovered at all: the checkout looks completely normal, the customer
// sees a success screen, the booking confirms, and the business receives
// nothing. Silent revenue loss with no error anywhere in the product.
//
// Runs server-side because the secret key must never reach the browser.
export async function POST(req: NextRequest) {
  if (!rateLimit(`paystack-validate:${getClientIp(req)}`, 20, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many attempts, please try again shortly' }, { status: 429 });
  }

  const { slug, secretKey, publicKey } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id', { requireOwner: true });
  if (auth.error) return auth.error;

  const sk = (secretKey ?? '').trim();
  const pk = (publicKey ?? '').trim();

  // Both blank means payments are simply switched off, which is valid.
  if (!sk && !pk) return NextResponse.json({ ok: true, configured: false });
  if (!sk || !pk) {
    return NextResponse.json({ ok: false, error: 'Paystack needs both keys. Add the missing one, or clear both to turn payments off.' });
  }

  if (!sk.startsWith('sk_')) {
    return NextResponse.json({ ok: false, error: 'That secret key does not look right. It should begin with sk_test_ or sk_live_.' });
  }
  if (!pk.startsWith('pk_')) {
    return NextResponse.json({ ok: false, error: 'That public key does not look right. It should begin with pk_test_ or pk_live_.' });
  }

  // A live public key with a test secret (or the reverse) fails only at
  // payment time, and confusingly.
  const skMode = sk.startsWith('sk_live_') ? 'live' : 'test';
  const pkMode = pk.startsWith('pk_live_') ? 'live' : 'test';
  if (skMode !== pkMode) {
    return NextResponse.json({
      ok: false,
      error: `Those keys are from different modes: the public key is ${pkMode} and the secret key is ${skMode}. Both must come from the same one.`,
    });
  }

  // Does Paystack actually accept the secret key?
  const res = await fetch('https://api.paystack.co/transaction/totals?perPage=1', {
    headers: { Authorization: `Bearer ${sk}` },
  }).catch(() => null);

  if (!res) {
    return NextResponse.json({ ok: false, error: "Couldn't reach Paystack to check those keys. Try again in a moment." });
  }
  if (res.status === 401) {
    return NextResponse.json({ ok: false, error: 'Paystack rejected that secret key. Copy it again from your Paystack dashboard, Settings then API Keys.' });
  }
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `Paystack returned an error (${res.status}) checking those keys. Try again shortly.` });
  }

  return NextResponse.json({ ok: true, configured: true, mode: skMode });
}
