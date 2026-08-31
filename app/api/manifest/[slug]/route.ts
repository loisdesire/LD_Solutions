import { NextRequest, NextResponse } from 'next/server';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';

// GET /api/manifest/[slug] - per-business web app manifest, so "Add to
// Home Screen" installs THIS business's dashboard (their own name, their
// own brand color, opening straight into their /admin) rather than one
// generic "Vanova" app shared across every tenant. Always uses Vanova's own
// icon set (public/icon-*.png), not the business's uploaded logo - a
// business logo isn't guaranteed to be square or well-formed, and a
// consistent installed-app icon is the more predictable choice anyway
// (the same reasoning most platforms use: the installed icon is the
// platform's, not the tenant's).
//
// Never cached at the edge - a business renaming itself or changing its
// accent color should be reflected the next time anyone (re)installs,
// not stuck behind a stale cached manifest.
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  const name = data?.business.name?.trim() || 'Vanova';
  const accent = data?.business.accent_color || '#C74A1E';

  const manifest = {
    name: `${name} — Vanova`,
    short_name: name.length > 12 ? `${name.slice(0, 11)}…` : name,
    description: `Manage bookings, services and customers for ${name}.`,
    start_url: `/${slug}/admin`,
    scope: `/${slug}/admin`,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#F7F5F2',
    theme_color: accent,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return NextResponse.json(manifest, { headers: { 'Content-Type': 'application/manifest+json' } });
}
