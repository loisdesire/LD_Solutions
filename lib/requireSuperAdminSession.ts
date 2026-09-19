import { createServerSupabase } from './supabase-server';
import { notFound, redirect } from 'next/navigation';

// Gates /super-admin/* - a platform-level area completely separate from
// any business's own staff/owner role. Deliberately NOT a new database
// table/role: this platform has exactly one operator today, and an
// env-var allowlist is the simplest thing that's actually correct for
// that - extend to a real table only once there's more than one person
// who needs this.
//
// Checked against whatever Supabase Auth session already exists (the
// same session /login or /[slug]/login produces) - there's no separate
// "super admin login" flow. Someone already logged in as staff on their
// own business, with an email that happens to be on this list, gets
// through; anyone else gets notFound() rather than a "you're not
// allowed" page, so the existence of this area isn't advertised to
// staff who happen to wander to the URL.
function getAllowedEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireSuperAdminSession() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/super-admin');

  const allowed = getAllowedEmails();
  const email = user.email?.toLowerCase();

  if (!email || allowed.length === 0 || !allowed.includes(email)) {
    notFound();
  }

  return { user, supabaseAdminClient: supabase };
}
