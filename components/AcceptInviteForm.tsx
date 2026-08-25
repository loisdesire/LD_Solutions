'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import { inputClass } from './formStyles';
import Field from './Field';

export default function AcceptInviteForm({ token, slug }: { token: string; slug: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<{ email: string; businessName: string } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(`/api/staff/invite-info?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInfo(data);
        }
        setChecking(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/staff/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    const supabase = createBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password,
    });

    if (signInError) {
      setError(friendlyError(signInError));
      setLoading(false);
      return;
    }

    router.push(`/${data.slug}/admin`);
    router.refresh();
  }

  if (checking) {
    return <p className="text-ink-soft text-[13.5px]">Checking invite…</p>;
  }

  if (!info) {
    return (
      <div className="border-2 border-line rounded-2xl p-5 bg-surface">
        <p className="text-sm text-error">{error || 'This invite is invalid or already used'}</p>
        <p className="text-ink-soft text-[13px] mt-2">
          If you&apos;ve already accepted it before, you already have an account for this team.
        </p>
        <Link href={`/${slug}/login`} className="inline-block mt-3 text-[13px] font-semibold text-accent hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-2 border-line rounded-2xl p-4 mb-2 bg-surface">
        <p className="text-[14px] font-semibold">{info.email}</p>
        <p className="text-ink-faint font-mono text-[11.5px] mt-1">Joining {info.businessName}</p>
      </div>

      <Field label="Set a password" required>
        {(props) => (
          <input
            {...props}
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="At least 8 characters"
          />
        )}
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-accent py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Joining…' : 'Accept invite'}
      </button>

      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
