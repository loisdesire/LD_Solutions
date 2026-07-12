import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server client: used in server components where you need to check the
// logged-in user's session (staff/admin areas). Kept in its own file
// because it imports next/headers, which can't be bundled into any module
// a Client Component also imports.
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render with no way to write
            // the response — safe to ignore, the login/signup flows that
            // actually need to persist a session run client-side instead.
          }
        },
      },
    }
  );
}
