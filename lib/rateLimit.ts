import { NextRequest } from 'next/server';

// In-memory, per-server-instance fixed-window rate limiter. Good enough to
// stop casual spam/abuse on a single-instance deployment; a serverless or
// multi-instance deployment would need a shared store (e.g. Upstash Redis)
// since each instance would otherwise track its own separate counts.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Buckets are never explicitly deleted, only overwritten once expired —
// sweep periodically so long-running processes don't accumulate memory
// from one-off IPs that never come back.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60_000).unref?.();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
