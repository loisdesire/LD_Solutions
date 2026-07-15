'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

const icons: Record<string, React.ReactNode> = {
  bookings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="13" width="7" height="7" rx="1.5" />
      <rect x="14" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  services: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  products: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M20 7L12 3 4 7m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  hours: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  staff: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
      <circle cx="9" cy="11" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M17 3.13A4 4 0 0117 11" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.51 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.51-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h0a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.51 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v0a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1z" />
    </svg>
  ),
};

export default function AdminSidebar({
  slug,
  businessName,
  businessType,
  userEmail,
  role,
}: {
  slug: string;
  businessName: string;
  businessType: string | null;
  userEmail: string;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const manage = [
    { href: `/${slug}/admin`, label: 'Dashboard', key: 'bookings' },
    { href: `/${slug}/admin/services`, label: 'Services', key: 'services' },
    { href: `/${slug}/admin/products`, label: 'Products', key: 'products' },
    { href: `/${slug}/admin/hours`, label: 'Hours', key: 'hours' },
    { href: `/${slug}/admin/staff`, label: 'Staff', key: 'staff' },
  ];
  const account = [{ href: `/${slug}/admin/settings`, label: 'Settings', key: 'settings' }];

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(`/${slug}/login`);
    router.refresh();
  }

  function NavLink({ href, label, iconKey }: { href: string; label: string; iconKey: string }) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] transition-colors ${
          active ? 'bg-surface border border-line font-medium text-ink shadow-soft' : 'text-ink-soft hover:bg-surface hover:text-ink'
        }`}
      >
        {icons[iconKey]}
        {label}
      </Link>
    );
  }

  return (
    <aside className="hidden md:flex md:w-[240px] shrink-0 border-r border-line flex-col py-6 px-4 sticky top-0 h-screen overflow-y-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-4 border-b border-line px-1">
        <div className="h-9 w-9 rounded-full border border-line-strong text-ink flex items-center justify-center font-display text-[15px] shrink-0">
          {businessName?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[14px] truncate">{businessName}</div>
          <div className="font-mono text-[10.5px] text-ink-faint truncate">
            {businessType ? `${businessType} · ` : ''}/{slug}
          </div>
        </div>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-2.5 mb-1.5">
        Manage
      </div>
      <nav className="flex flex-col gap-0.5 mb-5">
        {manage.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} />
        ))}
      </nav>

      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-2.5 mb-1.5">
        Account
      </div>
      <nav className="flex flex-col gap-0.5">
        {account.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} />
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-line flex items-center gap-2.5 px-1">
        <div className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center font-display text-[13px] shrink-0">
          {userEmail?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium truncate">{userEmail}</div>
          <div className="font-mono text-[10px] text-ink-faint capitalize">{role}</div>
        </div>
        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          className="p-1.5 text-ink-faint hover:text-ink transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
