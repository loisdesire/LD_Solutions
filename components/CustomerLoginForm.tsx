'use client';

import { useState } from 'react';
import { createCustomerBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import { SITE_URL } from '@/lib/site';

export default function CustomerLoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const supabase = createCustomerBrowserSupabase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${SITE_URL}/account/callback` },
      });

      if (signInError) {
        setStatus('error');
        setError(friendlyError(signInError, "Couldn't send that link. Please try again in a moment."));
        return;
      }

      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(friendlyError(err, "Couldn't send that link. Please try again in a moment."));
    }
  }

  if (status === 'sent') {
    return (
      <div className="animate-rise text-center">
        <h2 className="font-display text-[22px] mb-2">Check your email</h2>
        <p className="text-ink-soft text-[14px]">
          We sent a login link to <span className="font-semibold text-ink">{email}</span>. Click it to
          see your bookings.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-rise space-y-4">
      <div>
        <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">
          Email
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <p className="text-ink-faint text-[12px] mt-2">
          The same email you used when booking. We'll send a one-click login link — no password.
        </p>
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : 'Send login link'}
      </button>

      {status === 'error' && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
