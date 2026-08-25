'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import { inputClass } from './formStyles';
import Field from './Field';

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

  if (sent) {
    return (
      <div className="border-2 border-line rounded-2xl p-5 text-center bg-surface">
        <p className="font-semibold text-[14px]">Check your email</p>
        <p className="text-ink-soft text-[13px] mt-1">
          If an account exists for {email}, a reset link is on its way.
        </p>
      </div>
    );
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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-accent py-3 text-[14px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
