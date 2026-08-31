import Link from 'next/link';

type Group = 'today' | 'setup' | 'automate' | 'business';

// Shared across every admin page - same Today/Set up/Automate/Business
// grouping the real AdminSidebar uses, collapsed into a horizontal nav
// since this preview isn't reproducing the real sidebar chrome, just the
// content and its styling.
export default function AdminNav({ current }: { current: Group }) {
  return (
    <nav className="site-nav">
      <Link href="/design-preview/dashboard" className="logo">
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          G
        </span>
        Glow Salon
      </Link>
      <div className="nav-links">
        <Link href="/design-preview/dashboard" className={current === 'today' ? 'current' : ''}>
          Today
        </Link>
        <Link href="/design-preview/services" className={current === 'setup' ? 'current' : ''}>
          Set up
        </Link>
        <Link href="/design-preview/assistant" className={current === 'automate' ? 'current' : ''}>
          Automate
        </Link>
        <Link href="/design-preview/settings" className={current === 'business' ? 'current' : ''}>
          Business
        </Link>
      </div>
      <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
        owner@glowsalon.com
      </span>
    </nav>
  );
}
