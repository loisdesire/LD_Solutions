'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import { inputClass } from './formStyles';
import Field from './Field';

// Unlike LoginForm (which already knows which business's /admin to send
// you to, because the URL itself is /[slug]/login), this is the generic
// entry point for someone who doesn't remember their own booking page's
// URL - signs in first, then asks the server which business the account
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

    try {
      const supabase = createBrowserSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(friendlyError(signInError, 'Could not log you in. Please check your email and password.'));
        setLoading(false);
        return;
      }

      // A server-side lookup, not a client-side query run immediately after
      // sign-in - the client-side version was unreliable, coming back empty
      // even for accounts that genuinely have a staff row (see route comment
      // for why). Reading the session from cookies server-side, the same way
      // requireStaffSession already does successfully everywhere else, avoids
      // that race entirely.
      const res = await fetch('/api/my-business', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      router.push(`/${data.slug}/admin`);
      router.refresh();
    } catch (err) {
      setError(friendlyError(err, 'Something went wrong. Please try again.'));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Email" required>
        {(props) => (
          <input
            {...props}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field label="Password" required>
        {(props) => (
          <input
            {...props}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        )}
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-accent py-3 text-[14px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
      >
        {loading ? 'Signing in…' : 'Log in'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
