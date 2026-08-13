import type { Metadata } from 'next';
import { Inter, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { SITE_URL } from '@/lib/site';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Book an appointment',
    template: '%s',
  },
  description:
    'Book an appointment online in seconds — real-time availability, instant confirmation, no account needed.',
  // Without this, WebKit/Chromium auto-detect date/time-looking text
  // (e.g. "9 AM–5 PM" in the hours line) and silently style it like a
  // phone-number link — no anchor tag involved, just an odd blue tint
  // with no href behind it.
  other: { 'format-detection': 'telephone=no, date=no' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
