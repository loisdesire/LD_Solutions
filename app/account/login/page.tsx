import CustomerLoginForm from '@/components/CustomerLoginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

export default function CustomerLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-paper">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-[26px] mb-1.5 text-center">My bookings</h1>
        <p className="text-ink-soft text-[13.5px] mb-7 text-center">
          Log in to see your appointments, across every business you've booked with.
        </p>
        <CustomerLoginForm />
      </div>
    </main>
  );
}
