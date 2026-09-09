import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { resolveBankAccount } from '@/lib/flutterwave';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// GET /api/settings/flutterwave/resolve-account?slug=...&bankCode=...&accountNumber=...
// Live preview only - confirms the account name back as a business types,
// before they ever click Save. Deliberately just resolveBankAccount, never
// createSubaccount: this can fire on every debounced keystroke as someone
// picks a bank and finishes typing an account number, and creating a real
// Flutterwave subaccount on every one of those would be wasteful (and,
// worse, would leave a trail of subaccounts nobody asked for). Save is
// still the only action that actually links anything.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`flutterwave-resolve:${getClientIp(req)}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug');
  const bankCode = req.nextUrl.searchParams.get('bankCode');
  const accountNumber = req.nextUrl.searchParams.get('accountNumber');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  if (!bankCode || !/^\d{10}$/.test(accountNumber ?? '')) {
    return NextResponse.json({ error: 'Invalid bank or account number' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id', { requireOwner: true });
  if (auth.error) return auth.error;

  const resolved = await resolveBankAccount(accountNumber!, bankCode);
  if (!resolved) {
    return NextResponse.json({ error: "Couldn't verify that account - check the number and bank." });
  }

  return NextResponse.json({ accountName: resolved.accountName });
}
