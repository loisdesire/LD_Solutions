import type { Metadata } from 'next';
import { Manrope, Playfair_Display, IBM_Plex_Mono } from 'next/font/google';
import { SITE_URL } from '@/lib/site';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600'],
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
    <html lang="en" className={`${manrope.variable} ${playfair.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
