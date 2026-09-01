'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import AuthMark from '@/components/AuthMark';
import Field from '@/components/Field';
import { inputClass, labelClass } from '@/components/formStyles';

type SlugCheck = 'idle' | 'checking' | 'available' | 'taken';

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState('');
  const [slugCheck, setSlugCheck] = useState<SlugCheck>('idle');

  // Show the real domain this is running on, not a hardcoded placeholder -
  // window isn't available during server render, so this fills in on mount.
  useEffect(() => {
    setHost(window.location.host);
  }, []);

  // Debounced, not on every keystroke - previously the only "is this
  // taken" answer arrived after filling in email and password too and
  // pressing submit. A slug that collides is common (everyone tries
  // "glow-salon" or their own first name) and shouldn't cost a whole
  // failed form submission to discover.
  const checkSeq = useRef(0);
  useEffect(() => {
    if (slug.length < 2) {
      setSlugCheck('idle');
      return;
    }
    setSlugCheck('checking');
    const seq = ++checkSeq.current;
    const id = setTimeout(() => {
      fetch(`/api/signup/check-slug?slug=${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then((data) => {
          if (checkSeq.current !== seq) return; // a newer keystroke has already superseded this check
          setSlugCheck(data.available ? 'available' : 'taken');
        })
        .catch(() => {
          if (checkSeq.current === seq) setSlugCheck('idle');
        });
    }, 450);
    return () => clearTimeout(id);
  }, [slug]);

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

    try {
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
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      const supabase = createBrowserSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(friendlyError(signInError, 'Account created, but could not log you in automatically - try logging in.'));
        setLoading(false);
        return;
      }

      // Straight into the guided setup conversation, not the dashboard - a
      // brand-new business has nothing on it yet (no services, no hours),
      // so the dashboard would just be empty widgets. See
      // app/[slug]/onboarding/page.tsx.
      router.push(`/${slug}/onboarding`);
      router.refresh();
    } catch (err) {
      setError(friendlyError(err, 'Something went wrong. Please try again.'));
      setLoading(false);
    }
  }

  const slugId = useId();

  const features = [
    ['No setup fees.', 'Start taking bookings today.'],
    ['Your own link.', `${host || 'yoursite.com'}/your-name - share it anywhere.`],
    ['Customers just book.', 'No apps, no accounts, no friction.'],
  ];

  return (
    // min-h-[100dvh], not min-h-screen (100vh) - 100vh is pinned to the
    // full layout viewport and ignores the keyboard entirely, so this
    // page's own height never shrank when the keyboard opened, leaving
    // the browser fighting to scroll the focused field back into a
    // visible area that had already shrunk underneath it. Reads as
    // "the screen keeps moving" / "the keyboard covers the field" -
    // confirmed as a live complaint on this exact page. dvh tracks the
    // real visible height as the keyboard opens/closes, no JS needed.
    <main className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2 bg-paper">
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

      {/* items-start on mobile, not items-center - the left decorative
          panel is hidden below lg, so this becomes the ONLY grid cell and
          stretches to the full min-h-screen height by default; centering a
          short form inside that left a large dead gap above it (and,
          combined with mobile browsers' 100vh-vs-actual-visible-area
          mismatch, made the page scroll for no reason). Desktop keeps the
          centered look, which reads as intentional next to the left
          panel's own vertically-centered content. */}
      <div className="flex items-start lg:items-center justify-center px-4 py-8 sm:p-14">
        <div className="w-full max-w-sm animate-rise">
          <div className="lg:hidden mb-5">
            <AuthMark name="Vanova" label="Create your booking page" logoUrl="/logo.png" />
          </div>
          <h2 className="font-display text-[26px] mb-6 sm:mb-7">Create your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Business name" required>
              {(props) => (
                <input
                  {...props}
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    setSlug(slugify(e.target.value));
                  }}
                  className={inputClass}
                  placeholder="Your business name"
                />
              )}
            </Field>

            <div>
              {/* Not built with Field - the input sits inside a compound
                  bordered box (a {host}/ prefix span first) whose border
                  color itself reacts to slugCheck state, and the live
                  availability status below is referenced by a specific
                  fixed id already wired to aria-describedby. Real
                  htmlFor/id association either way, just wired by hand
                  rather than fighting Field's own layout for a shape it
                  wasn't built for. */}
              <label htmlFor={slugId} className={labelClass}>Choose your link</label>
              <div
                className={`flex items-stretch border-2 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-accent-soft transition-colors ${
                  slugCheck === 'taken' ? 'border-error' : 'border-line-strong focus-within:border-accent'
                }`}
              >
                <span className="bg-paper font-mono text-[12.5px] text-ink-faint px-3 flex items-center border-r border-line whitespace-nowrap">
                  {host || ' '}/
                </span>
                {/* focus:outline-none deliberately, not an oversight - the
                    parent box's own overflow-hidden was clipping the
                    global focus outline into a jagged half-visible
                    fragment. Safe to drop here specifically because the
                    parent already gives focus a real, visible, non-color-
                    only signal of its own (a 2px ring plus a border-color
                    change), so nothing is lost. */}
                <input
                  id={slugId}
                  required
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  aria-describedby="slug-availability"
                  className="flex-1 bg-surface border-0 text-[14px] px-3 py-2.5 outline-none focus:outline-none min-w-0"
                />
              </div>
              {/* Was only discoverable after filling in email and password
                  too and getting rejected on submit - a taken slug is
                  common (everyone tries their own first name, or
                  "glow-salon") and shouldn't cost a whole failed attempt. */}
              <p id="slug-availability" role="status" className="text-[12px] mt-1.5 h-4">
                {slugCheck === 'checking' && <span className="text-ink-faint">Checking availability…</span>}
                {slugCheck === 'available' && <span style={{ color: 'var(--success)' }}>/{slug} is available</span>}
                {slugCheck === 'taken' && <span className="text-error">/{slug} is already taken - try another</span>}
              </p>
            </div>

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

            <Field label="Password" required>
              {(props) => (
                <div className="relative">
                  <input
                    {...props}
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-ink-faint hover:text-ink transition-colors"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 5.1A9.9 9.9 0 0112 5c6.5 0 10 7 10 7a17.3 17.3 0 01-3.4 4.6M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 004.4-1" />
                        <path d="M9.9 9.9a3 3 0 004.2 4.2" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-accent py-3 text-[14px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating…' : 'Create booking page →'}
            </button>

            <p className="text-ink-faint text-[12px] text-center mt-3">
              By creating an account, you agree to Vanova&rsquo;s{' '}
              <Link href="/terms" className="text-ink-soft hover:text-ink underline underline-offset-2">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-ink-soft hover:text-ink underline underline-offset-2">Privacy Policy</Link>.
            </p>

            {error && <p className="text-sm text-error">{error}</p>}
          </form>

          <p className="text-ink-faint text-[12px] mt-5">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
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
