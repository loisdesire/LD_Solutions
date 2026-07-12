'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName,
        slug,
        ownerEmail: email,
        ownerPassword: password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

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
    <main className="min-h-screen bg-canvas bg-grid relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-md mx-auto px-6 py-16 sm:py-24 animate-rise">
        <header className="mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted shadow-sm mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Get started in minutes
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Create your <span className="text-gradient">business</span>
          </h1>
          <p className="text-muted mt-3">
            Set up your booking page and start taking appointments today.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
        >
          <div>
            <label className={labelClass}>Business name</label>
            <input
              required
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              className={inputClass}
              placeholder="Glow Salon"
            />
          </div>

          <div>
            <label className={labelClass}>Your booking page URL</label>
            <div className="flex items-center rounded-xl border border-line bg-white px-4 py-3 shadow-sm transition-all focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
              <span className="text-sm text-muted whitespace-nowrap">
                yourplatform.com/
              </span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="flex-1 bg-transparent border-0 text-ink outline-none min-w-0"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Your email</label>
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
            <label className={labelClass}>Password</label>
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
            {loading ? 'Creating…' : 'Create business →'}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </main>
  );
}
