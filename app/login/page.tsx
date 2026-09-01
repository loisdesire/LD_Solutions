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
    // min-h-[100dvh], not min-h-screen - see app/signup/page.tsx for why:
    // 100vh ignores the keyboard, dvh tracks the real visible height.
    <main className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2 bg-paper">
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

      {/* Same fix as signup/page.tsx - items-start on mobile, not
          items-center, since the left panel is hidden below lg and this
          becomes the only grid cell, stretched to min-h-screen; centering
          a short form in that left a dead gap above it. */}
      <div className="flex items-start lg:items-center justify-center px-4 py-8 sm:p-14">
        <div className="w-full max-w-sm animate-rise">
          <div className="lg:hidden mb-5">
            <AuthMark name="Vanova" label="Business owner login" logoUrl="/logo.png" />
          </div>
          <h2 className="font-display text-[26px] mb-6 sm:mb-7">Log in</h2>
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
