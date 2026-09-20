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
  const secret = process.env.CRON_SECRET;
  // `!= null` alone (checked here previously) only rules out CRON_SECRET
  // being entirely unset - it still passes for CRON_SECRET='' (set, but
  // empty, e.g. a deploy template that defines the var with no value
  // filled in). That leaves `expected` as the literal string 'Bearer ',
  // which a request sending exactly `Authorization: Bearer ` (no token at
  // all) then matches via timingSafeEqual - same shape as the
  // timingSafeEqualStrings('', '') bug already fixed elsewhere this
  // session, just reached through a different guard.
  if (secret == null || secret === '') return false;
  const expected = `Bearer ${secret}`;
  const gotBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  return gotBuf.length === expectedBuf.length && crypto.timingSafeEqual(gotBuf, expectedBuf);
}
