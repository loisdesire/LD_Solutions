'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Status = 'verifying' | 'success' | 'already' | 'error';

// No password, no user input at all - unlike AcceptInviteForm, clicking
// the link IS the whole action, so this fires the request on mount
// instead of waiting on a submit.
export default function VerifyEmailForm({ token, slug }: { token: string; slug: string }) {
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/staff/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? 'Could not verify this email.');
          setStatus('error');
          return;
        }
        setStatus(data.alreadyVerified ? 'already' : 'success');
      } catch {
        if (!cancelled) {
          setError('Could not verify this email. Please try again.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'verifying') {
    return (
      <div className="border-2 border-line rounded-2xl p-5 bg-surface text-center">
        <p className="text-[13.5px] text-ink-soft">Verifying…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="border-2 border-line rounded-2xl p-5 bg-surface">
        <p className="text-sm text-error">{error}</p>
        <Link
          href={`/${slug}/login`}
          className="inline-block mt-4 text-[13px] font-semibold text-accent hover:underline"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="border-2 border-line rounded-2xl p-5 bg-surface text-center">
      <p className="font-semibold text-[14px]">{status === 'already' ? 'Already verified' : 'Email verified'}</p>
      <p className="text-ink-soft text-[13px] mt-1">You&apos;re all set.</p>
      <Link
        href={`/${slug}/admin`}
        className="inline-block mt-4 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-contrast hover:opacity-90 transition-opacity"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
