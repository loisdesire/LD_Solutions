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
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Password</label>
          <Link href={`/${slug}/forgot-password`} className="text-[12px] font-medium text-accent hover:underline">
            Forgot?
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
        className="w-full rounded-md bg-accent py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-2"
      >
        {loading ? 'Signing in…' : 'Log in'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
