'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

export default function AcceptInviteForm({ token }: { token: string }) {
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
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    const supabase = createBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(`/${data.slug}/admin`);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder-muted/60 shadow-sm outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/10';

  if (checking) {
    return <p className="text-muted text-sm">Checking invite…</p>;
  }

  if (!info) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
        <p className="text-sm text-red-600">{error || 'This invite is invalid or already used'}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
    >
      <div>
        <p className="text-sm font-medium text-ink">{info.email}</p>
        <p className="text-muted text-sm">Joining {info.businessName}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Set a password</label>
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
        className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {loading ? 'Joining…' : 'Accept invite →'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
