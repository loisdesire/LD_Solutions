import Link from 'next/link';
import CustomerLoginForm from '@/components/CustomerLoginForm';
import AuthMark from '@/components/AuthMark';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

// No nav here on purpose - there's nothing to navigate to before you're
// logged in, this is a single-purpose entry gate, not a page in a site.
export default function CustomerLoginPage() {
  // items-start on mobile, not items-center - matching the fix on
  // signup/login, and for the same real bug: centering short content in a
  // min-h-screen box left a dead gap above it, and made the page scroll
  // on mobile browsers where 100vh doesn't match the actual visible area.
  return (
    <main className="min-h-screen flex items-start sm:items-center justify-center px-6 pt-14 sm:pt-6 bg-paper">
      <div className="w-full max-w-sm">
        {/* This page had no branding at all - and it's the one auth screen
            a business's own customer (not the business owner) reaches,
            arriving from a booking confirmation email that only says
            "Vanova". Without a mark here, "My bookings" reads as
            belonging to whichever business they last booked, not the
            platform account this actually is. */}
        <div className="flex justify-center">
          <AuthMark name="Vanova" label="Customer account" logoUrl="/logo.png" />
        </div>
        {/* Subtitle dropped - was the one thing on this page explaining
            itself in a full sentence while the business-owner login page
            right next to it (same AuthMark pattern) says just "Log in"
            and nothing else. "My bookings" plus the form below carries
            enough meaning without it; matching that page's terser shape
            was the actual ask. */}
        <h1 className="font-display text-[26px] mb-6 text-center">My bookings</h1>
        <CustomerLoginForm />
        <p className="text-ink-faint text-[12px] mt-5 text-center">
          Run a business on Vanova?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Business owner login
          </Link>
        </p>
      </div>
    </main>
  );
}
