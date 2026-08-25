'use client';

import { useState } from 'react';

type Business = {
  name: string;
  logo_url: string | null;
};

// Shared top nav for every public page under /[slug]/* (home, about,
// gallery, contact) - real hrefs to real pages now, not anchor scrolls
// within a single page. `active` highlights the current page; each
// optional link is passed in already resolved (toggle AND has-content),
// so this component doesn't need to know the business's raw data shape.
//
// The nav links used to be `hidden sm:inline` with no mobile fallback at
// all - on a phone, every link (About/Gallery/Contact/My bookings)
// simply vanished, leaving no way to navigate anywhere except "Book now"
// or the logo. A hamburger menu below restores all of them on mobile.
export default function SiteHeader({
  slug,
  business,
  active,
  showAbout,
  showGallery,
  showContact,
}: {
  slug: string;
  business: Business;
  active: 'home' | 'about' | 'gallery' | 'contact';
  showAbout: boolean;
  showGallery: boolean;
  showContact: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = (page: typeof active) =>
    `font-medium text-[13px] transition-colors ${
      active === page ? 'text-ink' : 'text-ink-soft hover:text-ink'
    }`;

  const links = [
    { key: 'home' as const, href: `/${slug}#book`, label: 'Services', show: true },
    { key: 'about' as const, href: `/${slug}/about`, label: 'About', show: showAbout },
    { key: 'gallery' as const, href: `/${slug}/gallery`, label: 'Gallery', show: showGallery },
    { key: 'contact' as const, href: `/${slug}/contact`, label: 'Contact', show: showContact },
  ].filter((l) => l.show);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-xl">
      <nav className="flex justify-between items-center w-full px-5 sm:px-8 py-3.5 max-w-6xl mx-auto">
        <a href={`/${slug}`} className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {business.logo_url ? (
            <img src={business.logo_url} alt="" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-cover shrink-0" />
          ) : (
            <div
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center font-display text-[13px] sm:text-[14px] font-semibold shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              {business.name?.[0]?.toUpperCase()}
            </div>
          )}
          {/* Smaller on mobile, not just truncated sooner - the sticky
              header also carries a "Book now" button and the menu
              trigger on small screens, so the name has less room to
              begin with; a size step buys back a few characters before
              the ellipsis has to do the rest of the work. */}
          <span className="font-display text-[14.5px] sm:text-[16px] font-semibold text-ink truncate">{business.name}</span>
        </a>

        {/* Desktop nav - unchanged */}
        <div className="hidden sm:flex items-center gap-7">
          {links.map((l) => (
            <a key={l.key} href={l.href} className={linkClass(l.key)}>
              {l.label}
            </a>
          ))}
          <a href="/account" className="font-medium text-[13px] text-ink-soft hover:text-ink transition-colors">
            My bookings
          </a>
          <a
            href={`/${slug}#book`}
            className="px-5 py-2.5 rounded-xl font-semibold text-[13px] text-accent-contrast transition-opacity hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            Book now
          </a>
        </div>

        {/* Mobile: book button always visible, everything else behind a menu */}
        <div className="flex sm:hidden items-center gap-1.5 shrink-0">
          <a
            href={`/${slug}#book`}
            className="px-3.5 py-2 rounded-xl font-semibold text-[13px] text-accent-contrast whitespace-nowrap"
            style={{ background: 'var(--accent)' }}
          >
            Book now
          </a>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="p-1.5 text-ink shrink-0"
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            )}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="sm:hidden border-t border-line bg-paper px-6 py-3 flex flex-col">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`py-3 border-b border-dashed border-line last:border-0 ${linkClass(l.key)}`}
            >
              {l.label}
            </a>
          ))}
          <a
            href="/account"
            onClick={() => setMenuOpen(false)}
            className="py-3 font-medium text-[13.5px] text-ink-soft"
          >
            My bookings
          </a>
        </div>
      )}
    </header>
  );
}
