import type { Metadata } from 'next';
import Link from 'next/link';
import PlatformLoginForm from '@/components/PlatformLoginForm';
import AuthMark from '@/components/AuthMark';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

// The generic entry point for a business owner who doesn't remember their
// own /[slug]/login URL - signs in here instead, and gets redirected to the
// right business automatically. /[slug]/login still exists and still works
// (it's what "Book now"-adjacent flows and bookmarks point at), this is
// just the other door in.
export default function PlatformLoginPage() {
  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-paper">
      {/* justify-center, not justify-between - this panel used to carry a
          third element at the bottom (a "New here?" link), which is why it
          was spread top/bottom. That link moved into the main column below
          (see its own comment), so this is just the eyebrow and headline
          now - centering them as one unit reads as intentional, not like
          something is missing from the bottom of the panel. */}
      <div
        className="hidden lg:flex flex-col justify-center gap-6 p-14 border-r border-line"
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
      </div>

      <div className="flex items-center justify-center p-6 sm:p-14">
        <div className="w-full max-w-sm animate-rise">
          <div className="lg:hidden">
            <AuthMark name="Vanova" label="Business owner login" />
          </div>
          <h2 className="font-display text-[26px] mb-7">Log in</h2>
          <PlatformLoginForm />
          {/* Both doors, same column, same weight, at every screen width -
              this used to bury "Create a booking page" in the decorative
              left panel (desktop only, small gray text at the very bottom)
              while "Find your bookings" sat right here in the main column.
              Backwards: driving signups matters more than a reminder to
              check a booking, and neither should depend on how wide the
              screen is. */}
          <p className="text-ink-faint text-[12px] mt-5">
            New here?{' '}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Create a booking page
            </Link>
          </p>
          <p className="text-ink-faint text-[12px] mt-2.5">
            Booked with a business instead?{' '}
            <Link href="/account/login" className="font-medium text-accent hover:underline">
              Find your booking
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
