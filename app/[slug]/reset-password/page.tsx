import ResetPasswordForm from '@/components/ResetPasswordForm';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-canvas bg-grid relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-md mx-auto px-6 py-16 sm:py-24 animate-rise">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Set a new <span className="text-gradient">password</span>
          </h1>
        </header>

        <ResetPasswordForm slug={slug} />
      </div>
    </main>
  );
}
