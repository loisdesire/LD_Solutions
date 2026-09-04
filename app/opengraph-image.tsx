import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

// Homepage had no Open Graph image at all - any link shared on WhatsApp
// (the exact channel this audience actually shares recommendations on,
// per the SEO audit) showed no preview image whatsoever, just bare text.
// Next's file convention: a file named exactly opengraph-image.tsx at
// this route level is picked up automatically and wired into both the
// og:image and twitter:image meta tags for app/page.tsx - no manual
// `images` array needed in that file's own metadata export.
export const alt = 'Vanova - an AI receptionist for appointment businesses';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Node runtime, not edge - this reads the logo file straight off disk
// (fs.readFileSync), which edge doesn't support. Runs once at build/
// request time either way; no real cost difference for a page this
// infrequently regenerated.
export default async function Image() {
  const logoData = readFileSync(join(process.cwd(), 'public', 'icon-512.png'));
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f6f2',
          padding: '80px',
        }}
      >
        <img src={logoSrc} width={128} height={128} style={{ marginBottom: 40 }} />
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#211f1b',
            letterSpacing: '-0.02em',
          }}
        >
          Vanova
        </div>
        <div
          style={{
            fontSize: 34,
            color: '#6e6a63',
            marginTop: 20,
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          Your customers ask for a time. The AI books it.
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 44,
            padding: '12px 28px',
            borderRadius: 999,
            background: '#c74a1e',
            color: '#fdf6ee',
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          AI receptionist for appointment businesses
        </div>
      </div>
    ),
    { ...size }
  );
}
