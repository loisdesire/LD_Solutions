import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { notFound } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-paper">
      <div
        className="hidden lg:flex flex-col justify-between p-14 border-r border-line"
        style={{ backgroundImage: 'linear-gradient(150deg, var(--accent-soft), var(--paper) 65%)' }}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {business.name}
        </div>
        <div>
          <h1 className="font-display text-[40px] leading-[1.08] max-w-md">
            Welcome back.
            <br />
            Your day's <span className="italic">waiting.</span>
          </h1>
          <p className="text-ink-soft text-[14px] mt-5 max-w-sm">
            Check today's schedule, manage your services, and keep your calendar tidy - all
            in one place.
          </p>
        </div>
        <div className="font-mono text-[11px] text-ink-faint">/{slug}</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-14">
        <div className="w-full max-w-sm animate-rise">
          <h2 className="font-display text-[26px] mb-7">Log in</h2>
          <LoginForm slug={slug} />
        </div>
      </div>
    </main>
  );
}
