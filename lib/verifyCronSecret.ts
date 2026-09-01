import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { rateLimit, getClientIp } from './rateLimit';

// Both cron routes (send-reminders, weekly-insights) compared the
// Authorization header with plain !==, and neither rate-limited the
// route at all - the exact pairing the Flutterwave webhook fix's own
// comment flags as "unlimited timed guesses at the real secret": a plain
// !== short-circuits on the first differing byte, leaking how many
// leading characters a guess got right through response timing, and
// with no rate limit there's nothing slowing down repeated guesses.
// Same fix as every webhook in this app - constant-time compare, plus
// the same request budget the webhooks use.
export async function verifyCronSecret(req: NextRequest, routeName: string): Promise<boolean> {
  if (!(await rateLimit(`cron:${routeName}:${getClientIp(req)}`, 10, 60_000))) {
    return false;
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const gotBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  return (
    process.env.CRON_SECRET != null &&
    gotBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(gotBuf, expectedBuf)
  );
}
