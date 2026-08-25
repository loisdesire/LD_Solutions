import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';
import AuthMark from '@/components/AuthMark';
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
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();
  const { business } = data;

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <AuthMark name={business.name} label="Business owner login" logoUrl={business.logo_url} />
        <h1 className="font-display text-[28px] mb-2">
          Reset your <span className="italic">password</span>
        </h1>
        <p className="text-ink-soft text-[13.5px] mb-7">We'll email you a link to get back in.</p>

        <ForgotPasswordForm slug={slug} />

        <Link
          href={`/${slug}/login`}
          className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-ink-faint hover:text-ink transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to login
        </Link>
      </div>
    </main>
  );
}
