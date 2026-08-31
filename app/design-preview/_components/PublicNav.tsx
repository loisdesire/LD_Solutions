import Link from 'next/link';

// Shared across the customer-facing pages (booking, about, gallery,
// contact) - Glow Salon's own nav, not Vanova's, since these are the
// business's own public pages.
export default function PublicNav({ current }: { current?: 'about' | 'gallery' | 'contact' }) {
  return (
    <nav className="site-nav">
      <Link href="/design-preview/booking" className="logo">
        Glow Salon
      </Link>
      <div className="nav-links">
        <Link href="/design-preview/about" className={current === 'about' ? 'current' : ''}>
          About
        </Link>
        <Link href="/design-preview/gallery" className={current === 'gallery' ? 'current' : ''}>
          Gallery
        </Link>
        <Link href="/design-preview/contact" className={current === 'contact' ? 'current' : ''}>
          Contact
        </Link>
      </div>
    </nav>
  );
}
