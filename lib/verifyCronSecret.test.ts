import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Guards every scheduled route (reminders, billing warnings, weekly
// insights, demo-data reset) - this app already shipped the exact bug
// class this file exists to prevent (a plain !== comparison, no rate
// limit, on these same routes - see the file's own comment). Writing
// this test surfaced a live variant of it: the old `!= null` guard let
// CRON_SECRET='' (set, but empty) through, which made an unauthenticated
// request sending exactly `Authorization: Bearer ` (no token) pass -
// same shape as the timingSafeEqualStrings('', '') bug fixed earlier
// this session. Fixed alongside writing these tests.
const rateLimitMock = vi.fn();
vi.mock('./rateLimit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  getClientIp: () => '127.0.0.1',
}));

const { verifyCronSecret } = await import('./verifyCronSecret');

function req(authorization?: string) {
  const headers = new Headers();
  if (authorization !== undefined) headers.set('authorization', authorization);
  return new NextRequest('http://localhost/api/scheduled/send-reminders', { headers });
}

beforeEach(() => {
  vi.resetAllMocks();
  rateLimitMock.mockResolvedValue(true);
  process.env.CRON_SECRET = 'a-real-cron-secret';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe('verifyCronSecret', () => {
  it('accepts the correct bearer token', async () => {
    await expect(verifyCronSecret(req('Bearer a-real-cron-secret'), 'send-reminders')).resolves.toBe(true);
  });

  it('rejects a wrong token of the same length', async () => {
    await expect(verifyCronSecret(req('Bearer a-wrong-cron-secret'), 'send-reminders')).resolves.toBe(false);
  });

  it('rejects a missing Authorization header entirely', async () => {
    await expect(verifyCronSecret(req(), 'send-reminders')).resolves.toBe(false);
  });

  it('rejects false before ever checking the secret when the route is rate-limited', async () => {
    rateLimitMock.mockResolvedValueOnce(false);
    await expect(verifyCronSecret(req('Bearer a-real-cron-secret'), 'send-reminders')).resolves.toBe(false);
  });

  it('rejects everything when CRON_SECRET is entirely unset', async () => {
    delete process.env.CRON_SECRET;
    await expect(verifyCronSecret(req('Bearer '), 'send-reminders')).resolves.toBe(false);
    await expect(verifyCronSecret(req(''), 'send-reminders')).resolves.toBe(false);
  });

  it('rejects everything when CRON_SECRET is set but empty - the regression this test exists to catch, not just an unset var', async () => {
    process.env.CRON_SECRET = '';
    await expect(verifyCronSecret(req('Bearer '), 'send-reminders')).resolves.toBe(false);
  });

  it('rate-limits per route name and per caller IP, not globally', async () => {
    await verifyCronSecret(req('Bearer a-real-cron-secret'), 'weekly-insights');
    expect(rateLimitMock).toHaveBeenCalledWith('cron:weekly-insights:127.0.0.1', expect.any(Number), expect.any(Number));
  });
});
