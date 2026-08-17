import AcceptInviteForm from '@/components/AcceptInviteForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <h1 className="font-display text-[28px] mb-7">
          Join the <span className="italic">team</span>
        </h1>

        {token ? (
          <AcceptInviteForm token={token} />
        ) : (
          <p className="text-sm text-error">Missing invite token.</p>
        )}
      </div>
    </main>
  );
}
