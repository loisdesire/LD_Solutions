'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';

export default function LoginForm({ slug }: { slug: string }) {
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(`/${slug}/admin`);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder-muted/60 shadow-sm outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/10';

  const labelClass = 'block text-sm font-medium text-ink mb-1.5';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
    >
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
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Password</label>
          <Link
            href={`/${slug}/forgot-password`}
            className="text-xs font-medium text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
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
        className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {loading ? 'Signing in…' : 'Sign in →'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
