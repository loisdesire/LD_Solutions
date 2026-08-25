'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import { inputClass, labelClass } from './formStyles';
import Field from './Field';

export default function LoginForm({ slug }: { slug: string }) {
  const router = useRouter();
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(friendlyError(signInError, 'Could not log you in. Please check your email and password.'));
        setLoading(false);
        return;
      }

      router.push(`/${slug}/admin`);
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
            hand instead. */}
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={passwordId} className={labelClass}>Password</label>
          <Link href={`/${slug}/forgot-password`} className="text-[12px] font-medium text-accent hover:underline">
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
        className="w-full rounded-full bg-accent py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
      >
        {loading ? 'Signing in…' : 'Log in'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
