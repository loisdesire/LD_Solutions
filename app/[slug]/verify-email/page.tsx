import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import VerifyEmailForm from '@/components/VerifyEmailForm';
import AuthMark from '@/components/AuthMark';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();
  const { business } = data;

  return (
    // min-h-[100dvh], not min-h-screen - see app/signup/page.tsx for why.
    <main className="min-h-[100dvh] bg-paper flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <AuthMark name={business.name} label="Verify your email" logoUrl={business.logo_url} />
        <h1 className="font-display text-[28px] mb-7">
          Confirm your <span className="italic">email</span>
        </h1>

        {token ? (
          <VerifyEmailForm token={token} slug={slug} />
        ) : (
          <div className="border-2 border-line rounded-2xl p-5 bg-surface">
            <p className="text-sm text-error">
              This verification link is missing its token, so we can&apos;t confirm it. Check the link in your
              email, or log in below.
            </p>
            <Link
              href={`/${slug}/login`}
              className="inline-block mt-4 text-[13px] font-semibold text-accent hover:underline"
            >
              Go to login
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
