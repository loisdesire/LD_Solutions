import ResetPasswordForm from '@/components/ResetPasswordForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <h1 className="font-display text-[28px] mb-7">
          Set a new <span className="italic">password</span>
        </h1>

        <ResetPasswordForm slug={slug} />
      </div>
    </main>
  );
}
