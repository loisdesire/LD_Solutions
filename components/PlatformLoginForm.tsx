'use client';

import { useState, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import { inputClass, labelClass } from './formStyles';
import Field from './Field';

// Unlike LoginForm (which already knows which business's /admin to send
// you to, because the URL itself is /[slug]/login), this is the generic
// entry point for someone who doesn't remember their own booking page's
// URL - signs in first, then asks the server which business the account
// actually belongs to, and redirects there.
export default function PlatformLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordId = useId();
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

      // ?next= (currently only /super-admin points here with one) skips
      // the business-lookup entirely rather than redirecting there
      // afterward - requireSuperAdminSession.ts's account may have no
      // staff row on any business at all, which would otherwise hit the
      // "Not authenticated"/no-business branch below and sign them right
      // back out before ever reaching the page they actually asked for.
      const next = searchParams.get('next');
      if (next && next.startsWith('/')) {
        router.push(next);
        router.refresh();
        return;
      }

      // A server-side lookup, not a client-side query run immediately after
      // sign-in - the client-side version was unreliable, coming back empty
      // even for accounts that genuinely have a staff row (see route comment
      // for why). Reading the session from cookies server-side, the same way
      // requireStaffSession already does successfully everywhere else, avoids
      // that race entirely... except this fetch itself fires the instant
      // signInWithPassword's promise resolves, and confirmed live: the
      // browser client's cookie write can still be a beat behind that -
      // this landed as a real "Not authenticated" on a genuine account with
      // the right password. One retry after a brief pause covers exactly
      // that gap without adding a real delay to the normal, non-racing case.
      let res = await fetch('/api/my-business', { cache: 'no-store' });
      if (res.status === 401) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        res = await fetch('/api/my-business', { cache: 'no-store' });
      }
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

      <div>
        {/* "Forgot?" link sits in the label row, so this doesn't fit
            Field's own label+input layout - real htmlFor/id wired by
            hand instead, same as LoginForm's [slug]/login version. */}
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={passwordId} className={labelClass}>Password</label>
          <Link href="/forgot-password" className="text-[12px] font-medium text-accent hover:underline">
            Forgot?
          </Link>
        </div>
        <input
          id={passwordId}
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
        className="w-full rounded-full bg-accent py-3 text-[14px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
      >
        {loading ? 'Signing in…' : 'Log in'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
