'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

// Was a single row of 6 pills in `overflow-x-auto` - on an actual phone
// width that's maybe 3 pills visible and the rest scrolled off with no
// hint they exist (and "Products" wasn't even in the list, a real dead
// end). Replaced with the same Manage/Account grouping the desktop
// sidebar uses, collapsed behind a "current page" toggle instead of
// trying to cram every destination into one line.
export default function AdminMobileNav({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Products isn't part of the MVP - kept working, just not promoted
  // in the primary nav (matches the desktop sidebar). Same three-group
  // split as AdminSidebar (Manage / Connect / Account), for the same
  // reason: a single 9-item "Manage" bucket had no sub-structure.
  const manage = [
    { href: `/${slug}/admin`, label: 'Dashboard' },
    { href: `/${slug}/admin/calendar`, label: 'Calendar' },
    { href: `/${slug}/admin/customers`, label: 'Customers' },
    { href: `/${slug}/admin/services`, label: 'Services' },
    { href: `/${slug}/admin/hours`, label: 'Hours' },
    { href: `/${slug}/admin/staff`, label: 'Staff' },
  ];
  const connect = [
    { href: `/${slug}/admin/channels`, label: 'Channels' },
  ];
  const account = [
    { href: `/${slug}/admin/assistant`, label: 'Assistant' },
    { href: `/${slug}/admin/billing`, label: 'Billing' },
    { href: `/${slug}/admin/settings`, label: 'Settings' },
  ];
  const currentLabel = [...manage, ...connect, ...account].find((t) => t.href === pathname)?.label ?? 'Dashboard';

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(`/${slug}/login`);
    router.refresh();
  }

  // Soft accent bg + accent text, matching AdminSidebar's active state -
  // previously this used a solid accent bg + inverted text, a different
  // treatment for the same concept depending on which breakpoint you were
  // on. The sidebar's soft treatment is the one with a documented
  // rationale (a solid-accent sidebar was tried and rejected as
  // overusing brand color), so that's the convention this now follows.
  function NavLink({ href, label }: { href: string; label: string }) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMenuOpen(false)}
        className={`flex items-center px-3 py-2.5 rounded-xl text-[14px] transition-colors ${
          active ? 'font-semibold' : 'text-ink-soft'
        }`}
        style={active ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="md:hidden border-b border-line bg-paper/95 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-accent text-white flex items-center justify-center font-display text-[14px] font-bold shrink-0">
            {businessName?.[0]?.toUpperCase()}
          </div>
          <span className="font-semibold text-body-sm truncate">{businessName}</span>
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav-menu"
          className="flex items-center gap-1.5 rounded-xl border-2 border-line-strong pl-3.5 pr-3 py-2 min-h-[40px] max-w-[52%] text-caption font-semibold text-ink shrink-0"
        >
          <span className="truncate">{currentLabel}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div id="admin-mobile-nav-menu" role="menu" className="border-t border-line px-4 py-4 animate-rise">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-3 mb-1.5">
            Manage
          </div>
          <nav className="flex flex-col gap-0.5 mb-4">
            {manage.map((tab) => (
              <NavLink key={tab.href} href={tab.href} label={tab.label} />
            ))}
          </nav>

          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-3 mb-1.5">
            Connect
          </div>
          <nav className="flex flex-col gap-0.5 mb-4">
            {connect.map((tab) => (
              <NavLink key={tab.href} href={tab.href} label={tab.label} />
            ))}
          </nav>

          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint px-3 mb-1.5">
            Account
          </div>
          <nav className="flex flex-col gap-0.5 mb-4">
            {account.map((tab) => (
              <NavLink key={tab.href} href={tab.href} label={tab.label} />
            ))}
          </nav>

          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2.5 rounded-xl text-[14px] text-ink-faint border-t border-line pt-4 mt-1"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
