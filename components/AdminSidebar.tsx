'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import NotificationBell from './NotificationBell';

// Both sidebar widths (the 72px rail and the full 256px one) used to
// hard-code a solid accent square with the business's first letter in
// it, full stop - a business that had actually gone and uploaded a real
// logo (Settings -> Business profile) never saw it anywhere in its own
// nav, the one place they look at all day. Same fallback either way: no
// logo just means the letter square, exactly as before this existed.
function BusinessMark({
  logoUrl,
  businessName,
  className,
}: {
  logoUrl?: string | null;
  businessName: string;
  className: string;
}) {
  if (logoUrl) {
    return (
      <div className={`relative overflow-hidden shrink-0 border border-line ${className}`}>
        <Image src={logoUrl} alt="" fill sizes="40px" className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`flex items-center justify-center text-accent-contrast font-display font-semibold shrink-0 ${className}`}
      style={{ background: 'var(--accent)' }}
    >
      {businessName?.[0]?.toUpperCase()}
    </div>
  );
}

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
};

type NavStatus = { setupIncomplete: boolean; channelsDisconnected: boolean; trialEndingSoon: boolean };

export default function AdminSidebar({
  slug,
  businessName,
  businessType,
  logoUrl,
  userEmail,
  role,
  navStatus,
}: {
  slug: string;
  businessName: string;
  businessType: string | null;
  logoUrl?: string | null;
  userEmail: string;
  role: string;
  navStatus: NavStatus;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Products isn't part of the MVP - the page/route/data still work for
  // anyone who already uses it, it's just not promoted in the primary
  // nav alongside the actual core flow (services, hours, staff).
  //
  // Regrouped from "Manage / Connect / Account" (implementation
  // categories - nothing there told an owner which bucket held what they
  // needed) to four groups named after the job, not the system area:
  // what you check today, what you set up once, what runs on its own,
  // and whole-business concerns. Assistant sits under Automate rather
  // than Business - it's the thing customers and staff actively talk to,
  // not a report you check once a month.
  // `badge` marks a nav item that wants a small attention dot - computed
  // once in the shared admin layout (app/[slug]/admin/layout.tsx) from
  // real data (the same three setup signals SetupChecklist uses, whether
  // any bot channel is connected, whether the trial is about to end), not
  // decorative. Only three items ever carry one; everything else is
  // undefined/false and renders with no dot at all.
  type NavItem = { href: string; label: string; key: string; badge: boolean; active?: boolean };

  const today: NavItem[] = [
    { href: `/${slug}/admin`, label: 'Dashboard', key: 'bookings', badge: navStatus.setupIncomplete },
    { href: `/${slug}/admin/calendar`, label: 'Calendar', key: 'calendar', badge: false },
    { href: `/${slug}/admin/customers`, label: 'Customers', key: 'customers', badge: false },
  ];
  // Staff, Channels, and the Settings sections below all redirect a
  // non-owner straight back to the dashboard (requireStaffSession's
  // `requireOwner` check, backed by owner-only RLS policies on the
  // actual data) - showing the link at all would just be a click that
  // goes nowhere. Billing stays visible for everyone: that page handles
  // a non-owner inline with a plain message instead of redirecting, so
  // there's no dead link there.
  const isOwner = role === 'owner';

  const setup: NavItem[] = [
    { href: `/${slug}/admin/services`, label: 'Services', key: 'services', badge: false },
    { href: `/${slug}/admin/hours`, label: 'Hours', key: 'hours', badge: false },
    ...(isOwner ? [{ href: `/${slug}/admin/staff`, label: 'Staff', key: 'staff', badge: false }] : []),
  ];
  // Was two destinations (Ask / Schedule) briefly, after an earlier audit
  // flagged one combined "Assistant" item as ambiguous about which job it
  // did. That split turned out to be the wrong fix: the assistant can do
  // far more than either of those two names implies (it is the same
  // agent that talks to customers on WhatsApp/Telegram/web chat, with the
  // owner-only tools added on top), so boxing it into "ask" or "schedule"
  // undersold it rather than clarifying it. One destination again -
  // /admin/assistant already handles both halves in a single thread
  // (see lib/assistantAgent.ts), and always did; only the nav was split.
  const automate: NavItem[] = [
    { href: `/${slug}/admin/assistant`, label: 'Assistant', key: 'insights', badge: false },
    ...(isOwner
      ? [{ href: `/${slug}/admin/channels`, label: 'Channels', key: 'channels', badge: navStatus.channelsDisconnected }]
      : []),
  ];
  const settingsHref = `/${slug}/admin/settings`;

  const business: NavItem[] = [
    { href: `/${slug}/admin/billing`, label: 'Billing', key: 'billing', badge: navStatus.trialEndingSoon },
    ...(isOwner ? [{ href: settingsHref, label: 'Settings', key: 'settings', badge: false }] : []),
  ];

  // Flat list for the compact rail (see below) - same items, no group
  // headers, since there's no room for them in a 72px-wide column.
  const allNavItems = [...today, ...setup, ...automate, ...business];

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(`/${slug}/login`);
    router.refresh();
  }

  function NavLink({
    href,
    label,
    iconKey,
    badge,
    active: activeOverride,
  }: {
    href: string;
    label: string;
    iconKey: string;
    badge?: boolean;
    active?: boolean;
  }) {
    const active = activeOverride ?? pathname === href;
    return (
      <Link
        href={href}
        className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body-sm transition-colors ${
          active ? 'font-semibold' : 'text-ink-soft hover:bg-warm-surface hover:text-ink'
        }`}
        style={active ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
      >
        {/* A left indicator bar on top of the soft fill, not instead of it -
            the combination is what modern dashboard apps (Linear, Vercel)
            use for "current location," and it reads more precise than a
            flat color fill alone. */}
        {active && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
            style={{ background: 'var(--accent)' }}
            aria-hidden="true"
          />
        )}
        <span className="relative shrink-0">
          {icons[iconKey]}
          {badge && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface"
              style={{ background: 'var(--warning)' }}
              aria-hidden="true"
            />
          )}
        </span>
        {label}
        {badge && <span className="sr-only"> - needs attention</span>}
      </Link>
    );
  }

  // The compact rail (below, 768-900px) has no room for a label next to
  // the icon - just the icon, a tooltip via `title`, and the same dot.
  function RailLink({
    href,
    label,
    iconKey,
    badge,
    active: activeOverride,
  }: {
    href: string;
    label: string;
    iconKey: string;
    badge?: boolean;
    active?: boolean;
  }) {
    const active = activeOverride ?? pathname === href;
    return (
      <Link
        href={href}
        title={label}
        aria-label={badge ? `${label} - needs attention` : label}
        className="relative flex items-center justify-center h-11 w-11 rounded-xl transition-colors"
        style={active ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
      >
        <span className={active ? '' : 'text-ink-soft'}>{icons[iconKey]}</span>
        {badge && (
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full border border-surface"
            style={{ background: 'var(--warning)' }}
            aria-hidden="true"
          />
        )}
      </Link>
    );
  }

  // Kept predominantly neutral - a solid brand-color sidebar was tried
  // and reads as exactly the "every component orange" overuse the
  // brand direction explicitly warns against. The accent shows up only
  // in the active nav item, matching how restraint is applied
  // everywhere else in the product.
  return (
    <>
    {/* Compact icon-only rail for the 768-900px dead zone - that width was
        getting the full mobile hamburger menu despite having room for a
        persistent nav, just not the full 256px sidebar's worth. Same
        destinations, same active/badge state, no group labels or business
        name (no room for either at 72px wide). */}
    <aside className="hidden md:flex min-[900px]:hidden w-[72px] shrink-0 bg-surface border-r border-line flex-col items-center py-5 gap-1.5 sticky top-0 h-screen overflow-y-auto">
      <div title={businessName} className="mb-4">
        <BusinessMark logoUrl={logoUrl} businessName={businessName} className="h-9 w-9 rounded-xl text-[14px]" />
      </div>
      {allNavItems.map((tab) => (
        <RailLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} badge={tab.badge} active={tab.active} />
      ))}
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <NotificationBell slug={slug} variant="rail" />
        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="h-11 w-11 flex items-center justify-center rounded-xl text-ink-faint hover:text-ink hover:bg-warm-surface transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>

    <aside className="hidden min-[900px]:flex md:w-[256px] shrink-0 bg-surface border-r border-line flex-col py-7 px-5 sticky top-0 h-screen overflow-y-auto">
      {/* Was "Salon · /glow-salon" underneath the name, permanently - a
          url slug an owner already knows (it's their own business) and
          has no reason to be reminded of on every single glance at their
          own nav. The real use for it (sharing/copying the link) already
          has a dedicated Copy link action on the dashboard header. Just
          the business type now, and only when there is one. */}
      <div className="mb-10 px-2">
        <div className="flex items-center gap-3">
          <BusinessMark logoUrl={logoUrl} businessName={businessName} className="h-10 w-10 rounded-xl text-[15px]" />
          <div className="min-w-0">
            <div className="font-display text-[17px] font-semibold text-ink tracking-tight truncate">{businessName}</div>
            {businessType && (
              <div className="text-[12px] text-ink-faint mt-0.5 truncate">{businessType}</div>
            )}
          </div>
        </div>
      </div>

      {/* Was plain small semibold text (11.5px, mixed case) - reading
          smaller than the 14px nav items it's supposed to introduce, with
          nothing else about it signaling "structural label" rather than
          "diminished body text", so it lost the visual-hierarchy job it
          was there to do. Same font-mono/uppercase/tracking eyebrow
          treatment already used for section labels elsewhere in this app
          (SettingsSections, the Assistant/Settings page headers) - reads
          as a deliberate label at a small size instead of weak text. */}
      <div className="font-mono text-label uppercase tracking-[0.1em] text-ink-faint px-3 mb-1.5">
        Today
      </div>
      <nav className="flex flex-col gap-0.5 mb-5">
        {today.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} badge={tab.badge} />
        ))}
      </nav>

      <div className="font-mono text-label uppercase tracking-[0.1em] text-ink-faint px-3 mb-1.5">
        Set up
      </div>
      <nav className="flex flex-col gap-0.5 mb-5">
        {setup.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} badge={tab.badge} />
        ))}
      </nav>

      <div className="font-mono text-label uppercase tracking-[0.1em] text-ink-faint px-3 mb-1.5">
        Automate
      </div>
      <nav className="flex flex-col gap-0.5 mb-5">
        {automate.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} badge={tab.badge} />
        ))}
      </nav>

      <div className="font-mono text-label uppercase tracking-[0.1em] text-ink-faint px-3 mb-1.5">
        Business
      </div>
      <nav className="flex flex-col gap-0.5">
        {business.map((tab) => (
          <NavLink key={tab.href} href={tab.href} label={tab.label} iconKey={tab.key} badge={tab.badge} active={tab.active} />
        ))}
      </nav>

      <div className="mt-auto pt-5 border-t border-line">
        <NotificationBell slug={slug} variant="row" />
        <div className="flex items-center gap-2.5 px-1 mt-1.5">
          <div
            className="h-10 w-10 rounded-2xl text-accent-contrast flex items-center justify-center font-display text-[15px] font-bold shrink-0"
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
      </div>
    </aside>
    </>
  );
}
