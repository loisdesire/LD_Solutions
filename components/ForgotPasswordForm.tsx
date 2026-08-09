'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';

export default function ForgotPasswordForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createBrowserSupabase();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/${slug}/reset-password`,
      });

      setLoading(false);

      if (resetError) {
        setError(friendlyError(resetError, "Couldn't send that link. Please try again in a moment."));
        return;
      }

      setSent(true);
    } catch (err) {
      setLoading(false);
      setError(friendlyError(err, "Couldn't send that link. Please try again in a moment."));
    }
  }

  const inputClass =
    'w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

  if (sent) {
    return (
      <div className="border border-line rounded-md p-5 text-center">
        <p className="font-semibold text-[14px]">Check your email</p>
        <p className="text-ink-soft text-[13px] mt-1">
          If an account exists for {email}, a reset link is on its way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">
          Email
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
