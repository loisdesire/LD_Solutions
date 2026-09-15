'use client';

import { useState } from 'react';

// Shown at the top of Settings whenever the signed-in staff member's own
// email hasn't been confirmed yet (see app/api/signup/route.ts and
// staff.email_verified_at). Page-level, not tied to any one settings
// section - it's about the account, not the business profile specifically.
export default function EmailVerificationBanner({ slug, email }: { slug: string; email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function resend() {
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/staff/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that, please try again.");
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setError("Couldn't send that, please try again.");
      setStatus('error');
    }
  }

  return (
    <div
      role="alert"
      className="mb-6 rounded-xl bg-warning-bg border border-warning-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
    >
      <p className="text-body-sm text-ink-soft">
        <b className="text-ink font-semibold">Verify your email</b> &mdash; we haven&rsquo;t confirmed {email} yet.
      </p>
      {status === 'sent' ? (
        <span className="text-body-sm font-medium" style={{ color: 'var(--success)' }}>
          Sent &mdash; check your inbox
        </span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={status === 'sending'}
          className="shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-[13px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Resend email'}
        </button>
      )}
      {status === 'error' && <p className="w-full text-body-sm text-error">{error}</p>}
    </div>
  );
}
