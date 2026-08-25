import Link from 'next/link';
import AcceptInviteForm from '@/components/AcceptInviteForm';
import AuthMark from '@/components/AuthMark';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <AuthMark name="Vanova" label="Team invite" logoUrl="/logo.png" />
        <h1 className="font-display text-[28px] mb-7">
          Join the <span className="italic">team</span>
        </h1>

        {token ? (
          <AcceptInviteForm token={token} slug={slug} />
        ) : (
          // Was a bare, dead-end sentence - technically accurate, useless
          // to whoever landed here (a mistyped/mangled link, most likely).
          <div className="border-2 border-line rounded-2xl p-5 bg-surface">
            <p className="text-sm text-error">
              This invite link is missing its token, so we can&apos;t look it up. Ask whoever invited you to send
              it again, or if you already have an account, log in directly.
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
