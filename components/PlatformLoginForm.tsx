'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

// Unlike LoginForm (which already knows which business's /admin to send
// you to, because the URL itself is /[slug]/login), this is the generic
// entry point for someone who doesn't remember their own booking page's
// URL — signs in first, then looks up which business the account actually
// belongs to (via the staff table, RLS-scoped to their own rows) and
// redirects there.
export default function PlatformLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { data: staffRow } = await supabase
      .from('staff')
      .select('business_id, businesses(slug)')
      .limit(1)
      .maybeSingle();

    // Supabase's join typing returns the related row array-shaped even for
    // this to-one relation (business_id -> businesses.id).
    const slug = (staffRow?.businesses as { slug: string }[] | null)?.[0]?.slug;

    if (!slug) {
      setError("We couldn't find a business linked to this account.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push(`/${slug}/admin`);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className={labelClass}>Password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-2"
      >
        {loading ? 'Signing in…' : 'Log in'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
