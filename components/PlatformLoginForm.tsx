'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

// Unlike LoginForm (which already knows which business's /admin to send
// you to, because the URL itself is /[slug]/login), this is the generic
// entry point for someone who doesn't remember their own booking page's
// URL — signs in first, then asks the server which business the account
// actually belongs to, and redirects there.
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

    // A server-side lookup, not a client-side query run immediately after
    // sign-in — the client-side version was unreliable, coming back empty
    // even for accounts that genuinely have a staff row (see route comment
    // for why). Reading the session from cookies server-side, the same way
    // requireStaffSession already does successfully everywhere else, avoids
    // that race entirely.
    const res = await fetch('/api/my-business', { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push(`/${data.slug}/admin`);
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
