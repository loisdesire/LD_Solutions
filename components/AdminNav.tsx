'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

export default function AdminNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { href: `/${slug}/admin`, label: 'Bookings' },
    { href: `/${slug}/admin/services`, label: 'Services' },
    { href: `/${slug}/admin/hours`, label: 'Hours' },
    { href: `/${slug}/admin/staff`, label: 'Staff' },
    { href: `/${slug}/admin/settings`, label: 'Settings' },
  ];

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(`/${slug}/login`);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 mb-10 flex-wrap">
      <nav className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                active ? 'bg-brand text-white shadow-glow' : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleSignOut}
        className="text-sm font-medium text-muted hover:text-ink transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
