type Business = {
  name: string;
  logo_url: string | null;
};

// Shared top nav for every public page under /[slug]/* (home, about,
// gallery, contact) — real hrefs to real pages now, not anchor scrolls
// within a single page. `active` highlights the current page; each
// optional link is passed in already resolved (toggle AND has-content),
// so this component doesn't need to know the business's raw data shape.
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
  const linkClass = (page: typeof active) =>
    `hidden sm:inline font-medium text-[13.5px] transition-colors ${
      active === page ? 'text-ink' : 'text-ink-soft hover:text-ink'
    }`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-paper border-b border-line">
      <nav className="flex justify-between items-center w-full px-6 sm:px-10 py-4 max-w-5xl mx-auto">
        <a href={`/${slug}`} className="flex items-center gap-2.5">
          {business.logo_url ? (
            <img src={business.logo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
          ) : (
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center font-display text-[13px] font-semibold shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              {business.name?.[0]?.toUpperCase()}
            </div>
          )}
          <span className="font-display text-[17px] font-semibold text-ink truncate">{business.name}</span>
        </a>
        <div className="flex items-center gap-6">
          <a href={`/${slug}#book`} className={linkClass('home')}>
            Services
          </a>
          {showAbout && (
            <a href={`/${slug}/about`} className={linkClass('about')}>
              About
            </a>
          )}
          {showGallery && (
            <a href={`/${slug}/gallery`} className={linkClass('gallery')}>
              Gallery
            </a>
          )}
          {showContact && (
            <a href={`/${slug}/contact`} className={linkClass('contact')}>
              Contact
            </a>
          )}
          <a href="/account" className="hidden sm:inline font-medium text-[13.5px] text-ink-soft hover:text-ink transition-colors">
            My bookings
          </a>
          <a
            href={`/${slug}#book`}
            className="px-5 py-2.5 rounded-full font-medium text-[13.5px] text-white transition-opacity hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            Book now
          </a>
        </div>
      </nav>
    </header>
  );
}
