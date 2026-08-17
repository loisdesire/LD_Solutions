'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';

export default function ResetPasswordForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createBrowserSupabase();

    // The reset link redirects here with a recovery token in the URL;
    // the client library exchanges it for a session automatically. We
    // just need to know when that's actually landed before letting the
    // customer submit a new password.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createBrowserSupabase();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      setLoading(false);

      if (updateError) {
        setError(friendlyError(updateError, "Couldn't set your new password. Please try again."));
        return;
      }

      router.push(`/${slug}/admin`);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(friendlyError(err, "Couldn't set your new password. Please try again."));
    }
  }

  const inputClass =
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

  if (!ready) {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="text-ink-soft text-[13.5px]">Verifying your reset link…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">
          New password
        </label>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="At least 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-accent py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Set new password'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
