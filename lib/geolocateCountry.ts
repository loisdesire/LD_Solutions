import { logError } from './logger';

// Signup no longer asks "where's your business based?" at all - the
// owner's own call: a cold question on a form nobody expects, when the
// answer is available for free from the request itself. Used once, at
// signup, to set businesses.home_country_code (supabase/schema.sql) -
// deliberately never re-run or re-checked afterward, so a business
// travelling or using a VPN later never has its own subscription pricing
// silently change under it.
//
// ip-api.com's free tier: no API key, no HTTPS on the free plan (fine -
// this is a server-to-server call, never exposed to a browser), 45
// requests/minute per calling IP, far more than signup volume needs.
export async function geolocateCountryCode(ip: string): Promise<string | null> {
  // Can't geolocate a missing/local IP (localhost in dev, or a proxy that
  // didn't set x-forwarded-for) - null here just means "unknown", not an
  // error, and every caller already treats null as "default to NG".
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return null;

  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data?.status !== 'success' || typeof data?.countryCode !== 'string') return null;
    return data.countryCode;
  } catch (err) {
    // Never blocks signup - a geolocation hiccup just means this business
    // defaults to NG pricing (the existing, safe default) instead of
    // failing the whole signup over a non-essential lookup.
    logError('geolocateCountryCode', err, { ip });
    return null;
  }
}

type CacheEntry = { code: string | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 3600_000; // 6 hours - an IP's country doesn't change minute to minute

// Same in-memory-Map-with-periodic-sweep shape as lib/rateLimit.ts's own
// localBuckets, for the same reason: this process is the only instance
// (Hostinger, not a serverless fleet), so a plain Map is real, effective
// caching here, not a per-instance approximation of a real one.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}, 3600_000).unref?.();

// The homepage now geolocates every anonymous visitor to show the right
// price (see app/page.tsx) - unlike signup, that runs on every single
// pageview, not once per new business. ip-api.com's free tier is 45
// requests/minute PER CALLING IP, and every request from this app shares
// one calling IP (a single Node process, not a serverless fleet) - real
// homepage traffic would blow past that in well under a minute without
// this cache, silently falling back to NG pricing for a growing share of
// visitors exactly when traffic is highest. A repeat visitor (or several
// people behind the same office/ISP NAT) now costs one real lookup, not
// one per pageview.
export async function geolocateCountryCodeCached(ip: string): Promise<string | null> {
  const cached = cache.get(ip);
  if (cached && Date.now() < cached.expiresAt) return cached.code;

  const code = await geolocateCountryCode(ip);
  cache.set(ip, { code, expiresAt: Date.now() + CACHE_TTL_MS });
  return code;
}
