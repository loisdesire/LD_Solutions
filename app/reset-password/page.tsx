import ResetPasswordForm from '@/components/ResetPasswordForm';
import AuthMark from '@/components/AuthMark';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

// Platform-level counterpart to /[slug]/reset-password - lands here for
// an account that requested its reset link from /forgot-password rather
// than /[slug]/forgot-password. ResetPasswordForm looks up which
// business the account belongs to itself once the new password is set.
export default function PlatformResetPasswordPage() {
  return (
    // min-h-[100dvh], not min-h-screen - see app/signup/page.tsx for why.
    <main className="min-h-[100dvh] bg-paper flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <AuthMark name="Vanova" label="Business owner login" logoUrl="/logo.png" />
        <h1 className="font-display text-[28px] mb-7">
          Set a new <span className="italic">password</span>
        </h1>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
