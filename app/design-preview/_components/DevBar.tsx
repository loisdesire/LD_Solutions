'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDesignPreviewTheme } from './ThemeShell';

const GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: 'Marketing',
    items: [
      { href: '/design-preview', label: 'Home' },
      { href: '/design-preview/login', label: 'Login' },
      { href: '/design-preview/signup', label: 'Sign up' },
    ],
  },
  {
    label: 'Customer site',
    items: [
      { href: '/design-preview/booking', label: 'Booking' },
      { href: '/design-preview/schedule', label: 'Choose a time' },
      { href: '/design-preview/details', label: 'Your details' },
      { href: '/design-preview/confirmed', label: 'Confirmed' },
      { href: '/design-preview/about', label: 'About' },
      { href: '/design-preview/gallery', label: 'Gallery' },
      { href: '/design-preview/contact', label: 'Contact' },
    ],
  },
  {
    label: 'Dashboard',
    items: [
      { href: '/design-preview/dashboard', label: 'Overview' },
      { href: '/design-preview/calendar', label: 'Calendar' },
      { href: '/design-preview/customers', label: 'Customers' },
      { href: '/design-preview/services', label: 'Services' },
      { href: '/design-preview/hours', label: 'Hours' },
      { href: '/design-preview/staff', label: 'Staff' },
      { href: '/design-preview/assistant', label: 'Assistant' },
      { href: '/design-preview/channels', label: 'Channels' },
      { href: '/design-preview/billing', label: 'Billing' },
      { href: '/design-preview/settings', label: 'Settings' },
    ],
  },
  {
    label: 'First run',
    items: [{ href: '/design-preview/onboarding', label: 'Onboarding' }],
  },
];

// Tool chrome only - never part of the design itself, and never shipped
// anywhere near the real app/[slug] routes. Real Next.js <Link> navigation
// throughout, not a JS toggle - this is meant to feel like clicking around
// an actual site, not a demo widget.
export default function DevBar() {
  const pathname = usePathname();
  const { theme, setTheme } = useDesignPreviewTheme();

  return (
    <div className="dp-devbar">
      {GROUPS.map((group) => (
        <div className="dp-group" key={group.label}>
          <span className="dp-label">{group.label}</span>
          {group.items.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'current' : ''}>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
      <div className="dp-spacer" />
      <button onClick={() => setTheme(theme === 'market' ? 'ledger' : 'market')}>
        {theme === 'market' ? 'Market Day (viewing)' : 'Kept Ledger (viewing) - back to Market Day'}
      </button>
    </div>
  );
}
