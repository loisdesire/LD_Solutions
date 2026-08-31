'use client';

import { useEffect } from 'react';

// Mounted once in app/[slug]/admin/layout.tsx. Registers the shared
// public/sw.js scoped to just THIS business's admin area
// (`/${slug}/admin`, no trailing slash so it also covers the dashboard
// root itself, not just its sub-pages) - installing one business's
// dashboard to a home screen never touches another business's, or the
// public marketing/booking site, which this service worker never controls.
export default function PwaRegister({ slug }: { slug: string }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: `/${slug}/admin` }).catch(() => {
      // Installability is a nice-to-have, not a page-breaking dependency -
      // an unsupported browser or a registration failure just means no
      // install prompt / no push, the dashboard itself still works fine.
    });
  }, [slug]);

  return null;
}
