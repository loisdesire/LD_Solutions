import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { getBankBranches } from '@/lib/flutterwave';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// GET /api/settings/flutterwave/branches?slug=...&bankId=... - Ghana (and
// Tanzania/Rwanda/Uganda, not offered here yet) subaccounts need a branch
// code alongside the bank + account number, a requirement Nigeria never
// has. bankId is the bank's Flutterwave-internal id from the banks list
// (banks/route.ts), not the "code" field used for account resolution -
// two different values, see lib/flutterwave.ts's own comment on why.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`flutterwave-branches:${getClientIp(req)}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug');
  const bankId = req.nextUrl.searchParams.get('bankId');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  if (!bankId) return NextResponse.json({ error: 'Missing bankId' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug);
  if (auth.error) return auth.error;

  const branches = await getBankBranches(bankId);
  if (!branches) {
    return NextResponse.json({ error: "Couldn't reach Flutterwave for the branch list. Try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ branches });
}
