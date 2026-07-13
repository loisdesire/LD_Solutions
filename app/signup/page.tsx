'use client';

import { useState, useEffect } from 'react';
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
  const [host, setHost] = useState('');

  // Show the real domain this is running on, not a hardcoded placeholder —
  // window isn't available during server render, so this fills in on mount.
  useEffect(() => {
    setHost(window.location.host);
  }, []);

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
    'w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

  const features = [
    ['No setup fees.', 'Start taking bookings today.'],
    ['Your own link.', `${host || 'yoursite.com'}/your-name — share it anywhere.`],
    ['Customers just book.', 'No apps, no accounts, no friction.'],
  ];

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-paper">
      <div
        className="hidden lg:flex flex-col justify-between p-14 border-r border-line"
        style={{ backgroundImage: 'linear-gradient(150deg, var(--accent-soft), var(--paper) 65%)' }}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          For business owners
        </div>
        <div>
          <h1 className="font-display text-[40px] leading-[1.08] max-w-md">
            Your booking page,
            <br />
            ready in <span className="italic">two minutes.</span>
          </h1>
          <div className="flex flex-col gap-3.5 mt-8">
            {features.map(([bold, rest]) => (
              <div key={bold} className="flex gap-3 text-[13.5px] text-ink-soft">
                <CheckDot />
                <div>
                  <b className="text-ink font-semibold">{bold}</b> {rest}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="font-mono text-[11px] text-ink-faint">Free to start</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-14">
        <div className="w-full max-w-sm animate-rise">
          <h2 className="font-display text-[26px] mb-7">Create your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className={labelClass}>Choose your link</label>
              <div className="flex items-stretch border border-line-strong rounded-md overflow-hidden focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft">
                <span className="bg-paper font-mono text-[12.5px] text-ink-faint px-3 flex items-center border-r border-line whitespace-nowrap">
                  {host || ' '}/
                </span>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  className="flex-1 bg-surface border-0 text-[14px] px-3 py-2.5 outline-none min-w-0"
                />
              </div>
            </div>

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
              className="w-full rounded-md bg-accent py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating…' : 'Create booking page →'}
            </button>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>

          <p className="text-ink-faint text-[12px] mt-5">
            Already have an account? Log in at your business's own{' '}
            <span className="font-mono">/login</span> page.
          </p>
        </div>
      </div>
    </main>
  );
}

function CheckDot() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" className="shrink-0 mt-0.5">
      <path d="M5 12l4 4 10-10" />
    </svg>
  );
}
