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
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-paper">
      <div className="w-full max-w-sm">
        {/* This page had no branding at all - and it's the one auth screen
            a business's own customer (not the business owner) reaches,
            arriving from a booking confirmation email that only says
            "Vanova". Without a mark here, "My bookings" reads as
            belonging to whichever business they last booked, not the
            platform account this actually is. */}
        <div className="flex justify-center">
          <AuthMark name="Vanova" label="Customer account" />
        </div>
        <h1 className="font-display text-[26px] mb-1.5 text-center">My bookings</h1>
        <p className="text-ink-soft text-[13.5px] mb-7 text-center">
          Log in to see your appointments, across every business you've booked with.
        </p>
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
