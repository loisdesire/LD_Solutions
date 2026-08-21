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
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5H21" />
      <path d="M8 3V6.5M16 3V6.5" strokeLinecap="round" />
    </svg>
  ),
  customers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  ),
  channels: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 4h16v12H8l-4 4V4z" />
      <path d="M8 9h8M8 12h5" />
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
  billing: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  ),
  insights: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
    </svg>
  ),
  scheduleAssistant: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5H21M8 3V6.5M16 3V6.5" strokeLinecap="round" />
      <path d="M8 13.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
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

  // Products isn't part of the MVP — the page/route/data still work for
  // anyone who already uses it, it's just not promoted in the primary
  // nav alongside the actual core flow (services, hours, staff).
  //
  // Three groups instead of two: the old single "Manage" bucket had 9
  // unrelated items with no sub-structure. Connect groups the two things
  // about how customers/staff reach the business (channels, the
  // scheduling assistant that messages customers); Account groups the
  // business-as-a-whole concerns (analytics, billing, configuration).
  const manage = [
    { href: `/${slug}/admin`, label: 'Dashboard', key: 'bookings' },
    { href: `/${slug}/admin/calendar`, label: 'Calendar', key: 'calendar' },
    { href: `/${slug}/admin/customers`, label: 'Customers', key: 'customers' },
    { href: `/${slug}/admin/services`, label: 'Services', key: 'services' },
    { href: `/${slug}/admin/hours`, label: 'Hours', key: 'hours' },
    { href: `/${slug}/admin/staff`, label: 'Staff', key: 'staff' },
  ];
  const connect = [
    { href: `/${slug}/admin/channels`, label: 'Channels', key: 'channels' },
    { href: `/${slug}/admin/schedule-assistant`, label: 'Schedule assistant', key: 'scheduleAssistant' },
  ];
  const account = [
    { href: `/${slug}/admin/insights`, label: 'Insights', key: 'insights' },
    { href: `/${slug}/admin/billing`, label: 'Billing', key: 'billing' },
    { href: `/${slug}/admin/settings`, label: 'Settings', key: 'settings' },
  ];

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
        className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-body-sm transition-colors ${
          active ? 'font-semibold' : 'text-ink-soft hover:bg-warm-surface hover:text-ink'
        }`}
        style={active ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
      >
        {icons[iconKey]}
        {label}
      </Link>
    );
  }

  // Kept predominantly neutral — a solid brand-color sidebar was tried
  // and reads as exactly the "every component orange" overuse the
  // brand direction explicitly warns against. The accent shows up only
  // in the active nav item, matching how restraint is applied
  // everywhere else in the product.
  return (
    <aside className="hidden md:flex md:w-[240px] shrink-0 bg-surface border-r border-line flex-col py-6 px-4 sticky top-0 h-screen overflow-y-auto">
      <div className="mb-8 px-1">
        <div className="font-display text-[19px] font-semibold text-ink tracking-tight">{businessName}</div>
        <div className="font-mono text-[10.5px] text-ink-faint mt-0.5">
          {businessType ? `${businessType} · ` : ''}/{slug}
        </div>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-3 mb-1.5">
        Manage
      </div>
      <nav className="flex flex-col gap-0.5 mb-5">
        {manage.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} />
        ))}
      </nav>

      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-3 mb-1.5">
        Connect
      </div>
      <nav className="flex flex-col gap-0.5 mb-5">
        {connect.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} />
        ))}
      </nav>

      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-3 mb-1.5">
        Account
      </div>
      <nav className="flex flex-col gap-0.5">
        {account.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} />
        ))}
      </nav>

      <div className="mt-auto pt-5 border-t border-line flex items-center gap-2.5 px-1">
        <div
          className="h-10 w-10 rounded-2xl text-white flex items-center justify-center font-display text-[15px] font-bold shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          {userEmail?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-caption font-medium truncate">{userEmail}</div>
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
