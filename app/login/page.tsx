import type { Metadata } from 'next';
import Link from 'next/link';
import PlatformLoginForm from '@/components/PlatformLoginForm';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

// The generic entry point for a business owner who doesn't remember their
// own /[slug]/login URL — signs in here instead, and gets redirected to the
// right business automatically. /[slug]/login still exists and still works
// (it's what "Book now"-adjacent flows and bookmarks point at), this is
// just the other door in.
export default function PlatformLoginPage() {
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
            Welcome back.
            <br />
            Your day's <span className="italic">waiting.</span>
          </h1>
        </div>
        <div className="font-mono text-[11px] text-ink-faint">
          New here?{' '}
          <Link href="/signup" className="underline hover:text-ink">
            Create a booking page
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-14">
        <div className="w-full max-w-sm animate-rise">
          <h2 className="font-display text-[26px] mb-7">Log in</h2>
          <PlatformLoginForm />
          <p className="text-ink-faint text-[12px] mt-5 lg:hidden">
            New here?{' '}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Create a booking page
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
