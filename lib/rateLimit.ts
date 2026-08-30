import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Bucket = { count: number; resetAt: number };
const localBuckets = new Map<string, Bucket>();
let sharedLimiterUnavailableLogged = false;

function localRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = localBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of localBuckets) {
    if (now > bucket.resetAt) localBuckets.delete(key);
  }
}, 5 * 60_000).unref?.();

// Uses one atomic Postgres counter across all serverless/process instances.
// The local fallback keeps development and not-yet-migrated deployments
// usable, while emitting one structured error so a missing migration is not
// silently mistaken for production-grade protection.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return localRateLimit(key, limit, windowMs);

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key.slice(0, 300),
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) throw error;
    return data === true;
  } catch (error) {
    if (!sharedLimiterUnavailableLogged) {
      sharedLimiterUnavailableLogged = true;
      console.error(JSON.stringify({
        level: 'error',
        context: 'rate-limit:shared-store-unavailable',
        message: error instanceof Error ? error.message : String(error),
      }));
    }
    return localRateLimit(key, limit, windowMs);
  }
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
