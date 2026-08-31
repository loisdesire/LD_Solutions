import type { Metadata } from 'next';
import ThemeShell from './_components/ThemeShell';
import DevBar from './_components/DevBar';
import './preview.css';

// Design exploration only - not part of the real product, never linked to
// from it. Lives at /design-preview so it's reachable locally
// (npm run dev -> localhost:3000/design-preview) for actually clicking
// through it, but stays completely isolated: its own stylesheet (imported
// only here), its own fonts, noindex, and a distinct visual "this is a
// tool" dev bar so it's never mistaken for the real site. Safe to delete
// this whole folder once a direction is picked and built for real.
export const metadata: Metadata = {
  title: 'Design preview',
  robots: { index: false, follow: false },
};

export default function DesignPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Work+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Karla:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <DevBar />
      <ThemeShell>{children}</ThemeShell>
    </>
  );
}
