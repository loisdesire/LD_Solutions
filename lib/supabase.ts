import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Public client: used in customer-facing booking pages (anon key, RLS-restricted)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Two separate browser clients, each a module-level singleton (a fresh
// client on every call used to spin up multiple independent GoTrueClient
// instances all racing on the same storage key — see the singleton comment
// below), and each on its OWN cookie name. Business-owner login (/[slug]
// /login) and customer login (/account/login) both use Supabase Auth, but
// they're different identities playing different roles — without separate
// cookies, whichever one was logged in most recently in a browser is who
// the OTHER area sees too. A business owner testing their own site as a
// "customer" would land on /account already logged in as themselves,
// seeing their own admin identity's bookings instead of a real customer
// flow. Distinct cookies keep the two fully independent, exactly like two
// different accounts on two different sites would be.
let staffBrowserClient: SupabaseClient | undefined;
let customerBrowserClient: SupabaseClient | undefined;

// Browser client for staff/business-owner login. Persists the session in
// cookies (not just localStorage) so server components can read the same
// session on the next request.
export function createBrowserSupabase() {
  if (!staffBrowserClient) {
    staffBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return staffBrowserClient;
}

// Browser client for customer login (/account) — same project, deliberately
// separate cookie namespace from the staff client above.
export function createCustomerBrowserSupabase() {
  if (!customerBrowserClient) {
    customerBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: { name: 'sb-customer-auth-token' } }
    );
  }
  return customerBrowserClient;
}
