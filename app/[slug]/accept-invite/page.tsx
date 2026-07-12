import AcceptInviteForm from '@/components/AcceptInviteForm';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="min-h-screen bg-canvas bg-grid relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-md mx-auto px-6 py-16 sm:py-24 animate-rise">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Join the <span className="text-gradient">team</span>
          </h1>
        </header>

        {token ? (
          <AcceptInviteForm token={token} />
        ) : (
          <p className="text-sm text-red-600">Missing invite token.</p>
        )}
      </div>
    </main>
  );
}
