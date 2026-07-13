import ForgotPasswordForm from '@/components/ForgotPasswordForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <h1 className="font-display text-[28px] mb-2">
          Reset your <span className="italic">password</span>
        </h1>
        <p className="text-ink-soft text-[13.5px] mb-7">We'll email you a link to get back in.</p>

        <ForgotPasswordForm slug={slug} />
      </div>
    </main>
  );
}
