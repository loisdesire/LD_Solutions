import ForgotPasswordForm from '@/components/ForgotPasswordForm';

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-canvas bg-grid relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-md mx-auto px-6 py-16 sm:py-24 animate-rise">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Reset your <span className="text-gradient">password</span>
          </h1>
          <p className="text-muted mt-3">
            We'll email you a link to get back in.
          </p>
        </header>

        <ForgotPasswordForm slug={slug} />
      </div>
    </main>
  );
}
