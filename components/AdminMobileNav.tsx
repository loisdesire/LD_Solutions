'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

export default function AdminMobileNav({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { href: `/${slug}/admin`, label: 'Bookings' },
    { href: `/${slug}/admin/services`, label: 'Services' },
    { href: `/${slug}/admin/hours`, label: 'Hours' },
    { href: `/${slug}/admin/staff`, label: 'Team' },
    { href: `/${slug}/admin/settings`, label: 'Settings' },
  ];

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(`/${slug}/login`);
    router.refresh();
  }

  return (
    <div className="md:hidden border-b border-line">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-accent text-white flex items-center justify-center font-display text-[13px] shrink-0">
            {businessName?.[0]?.toUpperCase()}
          </div>
          <span className="font-semibold text-[13.5px] truncate">{businessName}</span>
        </div>
        <button onClick={handleSignOut} className="text-[12px] text-ink-faint">
          Sign out
        </button>
      </div>
      <nav className="flex items-center gap-1 px-4 pb-3 overflow-x-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] font-mono uppercase tracking-wide transition-colors ${
                active ? 'bg-ink text-paper' : 'text-ink-soft'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
