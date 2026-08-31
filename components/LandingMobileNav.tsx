'use client';

import { useState } from 'react';

// The marketing nav's "How it works / Features / Pricing" links (and
// "Demo") are `hidden md:flex`/`hidden sm:inline` with no mobile
// equivalent - below md there was no way to reach those sections except
// scrolling past everything, the exact same gap AdminNav had before it
// got a real mobile menu. This is that same fix for the public homepage.
export default function LandingMobileNav({ demoHref }: { demoHref: string }) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: '#how-it-works', label: 'How it works' },
    { href: '#features', label: 'Features' },
    { href: '#pricing', label: 'Pricing' },
    { href: demoHref, label: 'Try the live demo' },
  ];

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-soft hover:bg-warm-surface hover:text-ink transition-colors shrink-0"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id="landing-mobile-menu"
          className="absolute left-0 right-0 top-full border-b border-line bg-paper shadow-[0_16px_30px_-16px_rgba(32,32,32,0.25)] px-4 py-2 flex flex-col"
        >
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="px-1 py-3 text-[15px] font-medium text-ink-soft hover:text-ink transition-colors border-b border-line last:border-0"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
