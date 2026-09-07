import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { listNigerianBanks } from '@/lib/flutterwave';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// GET /api/settings/flutterwave/banks?slug=... - the bank picker's option
// list for PaymentsManager. Not business-specific data (every business
// picks from the same national bank list), but still kept behind staff
// auth like every other settings read in this app rather than left open -
// no reason to let an unauthenticated request spend this app's own
// Flutterwave API budget for free. Any staff member can view it (this is
// read-only and reveals nothing about the business); only linking an
// actual account is owner-only, enforced in link-account/route.ts.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`flutterwave-banks:${getClientIp(req)}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug);
  if (auth.error) return auth.error;

  const banks = await listNigerianBanks();
  if (!banks) return NextResponse.json({ error: "Couldn't reach Flutterwave for the bank list. Try again shortly." }, { status: 502 });

  return NextResponse.json({ banks });
}
