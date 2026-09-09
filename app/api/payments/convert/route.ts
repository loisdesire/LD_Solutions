import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConvertedAmount, FOREIGN_CURRENCIES } from '@/lib/flutterwave';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/payments/convert?slug=...&amount=...&currency=... - a live
// quote for BookingForm's currency selector, public (no staff auth - a
// customer booking anonymously needs this before they've identified
// themselves at all). Informational only: the server never trusts this
// value back from the client at verify-time (app/api/bookings/route.ts
// independently re-fetches a fresh rate and checks the real Flutterwave-
// verified amount against it) - this route exists purely so a customer
// sees a real number before paying, not as part of the trust boundary.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`payments-convert:${getClientIp(req)}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug');
  const amount = Number(req.nextUrl.searchParams.get('amount'));
  const currency = req.nextUrl.searchParams.get('currency');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  if (!currency || !(FOREIGN_CURRENCIES as readonly string[]).includes(currency)) {
    return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 });
  }

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('currency, accept_foreign_currency')
    .eq('slug', slug)
    .maybeSingle();

  if (!business?.accept_foreign_currency) {
    return NextResponse.json({ error: 'This business does not accept foreign-currency payments.' }, { status: 400 });
  }

  const converted = await getConvertedAmount(amount, business.currency ?? 'NGN', currency);
  if (!converted) {
    return NextResponse.json({ error: "Couldn't get a live rate right now. Try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ amount: converted.amount, currency, rate: converted.rate });
}
