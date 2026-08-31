'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import NotificationBell from './NotificationBell';

// Was a single row of 6 pills in `overflow-x-auto` - on an actual phone
// width that's maybe 3 pills visible and the rest scrolled off with no
// hint they exist (and "Products" wasn't even in the list, a real dead
// end). Replaced with the same Today/Set up/Automate/Business grouping
// the desktop sidebar uses, collapsed behind a "current page" toggle
// instead of trying to cram every destination into one line.
type NavStatus = { setupIncomplete: boolean; channelsDisconnected: boolean; trialEndingSoon: boolean };

export default function AdminMobileNav({
  slug,
  businessName,
  logoUrl,
  navStatus,
  role,
}: {
  slug: string;
  businessName: string;
  logoUrl?: string | null;
  navStatus: NavStatus;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Staff, Channels, and the Settings sections all redirect a non-owner
  // straight back to the dashboard - same reasoning as AdminSidebar.
  // Billing stays visible for everyone since it handles a non-owner
  // inline instead of redirecting.
  const isOwner = role === 'owner';

  // Products isn't part of the MVP - kept working, just not promoted
  // in the primary nav (matches the desktop sidebar). Same four-group
  // split as AdminSidebar (Today / Set up / Automate / Business) -
  // named after the job, not the system area, so a phone menu with no
  // sidebar to cross-reference still reads as "where do I go for X"
  // rather than "which implementation bucket is X filed under".
  const today = [
    { href: `/${slug}/admin`, label: 'Dashboard', badge: navStatus.setupIncomplete },
    { href: `/${slug}/admin/calendar`, label: 'Calendar', badge: false },
    { href: `/${slug}/admin/customers`, label: 'Customers', badge: false },
  ];
  const setup = [
    { href: `/${slug}/admin/services`, label: 'Services', badge: false },
    { href: `/${slug}/admin/hours`, label: 'Hours', badge: false },
    ...(isOwner ? [{ href: `/${slug}/admin/staff`, label: 'Staff', badge: false }] : []),
  ];
  // One "Assistant" destination, not split into "Ask"/"Schedule" - see
  // AdminSidebar's comment. /admin/assistant already handles both halves
  // in one thread.
  const automate = [
    { href: `/${slug}/admin/assistant`, label: 'Assistant', badge: false },
    ...(isOwner ? [{ href: `/${slug}/admin/channels`, label: 'Channels', badge: navStatus.channelsDisconnected }] : []),
  ];
  const settingsHref = `/${slug}/admin/settings`;

  const business = [
    { href: `/${slug}/admin/billing`, label: 'Billing', badge: navStatus.trialEndingSoon, active: undefined as boolean | undefined },
    ...(isOwner ? [{ href: settingsHref, label: 'Settings', badge: false, active: pathname === settingsHref }] : []),
  ];
  const currentLabel = [...today, ...setup, ...automate, ...business].find((t) => t.href === pathname)?.label ?? 'Dashboard';
  const anyBadge = navStatus.setupIncomplete || navStatus.channelsDisconnected || navStatus.trialEndingSoon;

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
  function NavLink({
    href,
    label,
    badge,
    active: activeOverride,
  }: {
    href: string;
    label: string;
    badge?: boolean;
    active?: boolean;
  }) {
    const active = activeOverride ?? pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMenuOpen(false)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[14px] transition-colors ${
          active ? 'font-semibold' : 'text-ink-soft'
        }`}
        style={active ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
      >
        {label}
        {badge && (
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: 'var(--warning)' }}
            aria-hidden="true"
          />
        )}
        {badge && <span className="sr-only"> - needs attention</span>}
      </Link>
    );
  }

  return (
    <div className="md:hidden border-b border-line bg-paper/95 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {logoUrl ? (
            <div className="relative h-8 w-8 rounded-xl overflow-hidden border border-line shrink-0">
              <Image src={logoUrl} alt="" fill sizes="32px" className="object-cover" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-xl bg-accent text-accent-contrast flex items-center justify-center font-display text-[14px] font-bold shrink-0">
              {businessName?.[0]?.toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-body-sm truncate">{businessName}</span>
        </div>
        {/* Was a bordered pill with a chevron - the exact shape and affordance
            of an HTML <select>, for what's actually the primary navigation
            trigger. A menu control shouldn't look like a form field. This
            keeps the same "which page am I on" info (genuinely useful with
            no persistent sidebar to check against) but as a plain label
            next to a real menu icon, the same open/close hamburger-to-X
            swap used elsewhere in this app (see WebChatWidget's toggle) -
            unambiguous as "this opens a menu," not "this picks a value." */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav-menu"
          className="relative flex items-center gap-2 rounded-xl pl-3 pr-2 py-1.5 min-h-[40px] max-w-[58%] text-ink shrink-0 hover:bg-warm-surface transition-colors"
        >
          <span className="text-caption font-semibold truncate">{currentLabel}</span>
          <span className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-warm-surface shrink-0">
            {anyBadge && (
              <span
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper"
                style={{ background: 'var(--warning)' }}
                aria-hidden="true"
                title="Something needs attention"
              />
            )}
            {menuOpen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            )}
          </span>
        </button>
      </div>

      {menuOpen && (
        <div id="admin-mobile-nav-menu" role="menu" className="border-t border-line px-4 py-4 animate-rise">
          <div className="text-[11.5px] font-semibold text-ink-faint px-3 mb-1.5">
            Today
          </div>
          <nav className="flex flex-col gap-0.5 mb-4">
            {today.map((tab) => (
              <NavLink key={tab.href} href={tab.href} label={tab.label} badge={tab.badge} />
            ))}
          </nav>

          <div className="text-[11.5px] font-semibold text-ink-faint px-3 mb-1.5">
            Set up
          </div>
          <nav className="flex flex-col gap-0.5 mb-4">
            {setup.map((tab) => (
              <NavLink key={tab.href} href={tab.href} label={tab.label} badge={tab.badge} />
            ))}
          </nav>

          <div className="text-[11.5px] font-semibold text-ink-faint px-3 mb-1.5">
            Automate
          </div>
          <nav className="flex flex-col gap-0.5 mb-4">
            {automate.map((tab) => (
              <NavLink key={tab.href} href={tab.href} label={tab.label} badge={tab.badge} />
            ))}
          </nav>

          <div className="text-[11.5px] font-semibold text-ink-faint px-3 mb-1.5">
            Business
          </div>
          <nav className="flex flex-col gap-0.5 mb-4">
            {business.map((tab) => (
              <NavLink key={tab.href} href={tab.href} label={tab.label} badge={tab.badge} active={tab.active} />
            ))}
          </nav>

          <div className="border-t border-line pt-1 mt-1">
            <NotificationBell slug={slug} variant="row" />
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2.5 rounded-xl text-[14px] text-ink-faint"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
