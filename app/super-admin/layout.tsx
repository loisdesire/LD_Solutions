import { requireSuperAdminSession } from '@/lib/requireSuperAdminSession';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Super Admin', robots: { index: false, follow: false } };

// Platform-level admin, not a business's own /[slug]/admin - see
// lib/requireSuperAdminSession.ts for how access is actually gated
// (an env-var email allowlist, not a database role, since there's
// exactly one operator today).
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminSession();

  return (
    <div className="min-h-screen bg-warm-surface">
      <div className="border-b border-line bg-surface">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Vanova</div>
            <Link href="/super-admin" className="font-display text-[18px] text-ink hover:opacity-80 transition-opacity">
              Super Admin
            </Link>
          </div>
          <Link href="/" className="text-[13px] font-medium text-ink-faint hover:text-ink transition-colors">
            Back to site
          </Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">{children}</div>
    </div>
  );
}
