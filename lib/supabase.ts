import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Public client: used in customer-facing booking pages (anon key, RLS-restricted)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Browser client: used client-side for staff login. Persists the session in
// cookies (not just localStorage) so server components can read the same
// session on the next request.
//
// Cached as a module-level singleton rather than creating a fresh client on
// every call — this used to construct a brand new GoTrueClient each time,
// and since many different components call this function, the app was
// running several independent auth clients simultaneously, all reading and
// writing the same underlying storage key ("Multiple GoTrueClient instances
// detected... may produce undefined behavior" in the console). That's a
// real, documented Supabase footgun, not just a noisy warning — a sign-in
// on one instance isn't guaranteed to be immediately visible to another
// instance's view of the session, which is exactly the kind of "it signed
// in but the next check doesn't see it" symptom this was producing.
let browserClient: SupabaseClient | undefined;

export function createBrowserSupabase() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
