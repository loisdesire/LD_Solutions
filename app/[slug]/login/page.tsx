import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { notFound } from 'next/navigation';
import LoginForm from '@/components/LoginForm';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);

  if (!data) notFound();

  const { business } = data;

  return (
    <main className="min-h-screen bg-canvas bg-grid relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-md mx-auto px-6 py-16 sm:py-24 animate-rise">
        <header className="mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted shadow-sm mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {business.name}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Welcome <span className="text-gradient">back</span>
          </h1>
          <p className="text-muted mt-3">Sign in to manage your bookings.</p>
        </header>

        <LoginForm slug={slug} />
      </div>
    </main>
  );
}
