import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { SITE_URL } from '@/lib/site';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Vanova | AI booking receptionist for appointment businesses',
    template: '%s',
  },
  description:
    'An AI booking receptionist for salons, clinics, tutors, coaches, and other appointment businesses. Answer customer questions, check real availability, and book appointments automatically.',
  keywords: [
    'AI booking receptionist',
    'appointment booking software',
    'online booking for small businesses',
    'salon booking software',
    'real-time appointment scheduling',
    'customer booking automation',
  ],
  applicationName: 'Vanova',
  category: 'business',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Vanova | Your AI booking receptionist',
    description:
      'Let customers ask for an appointment, check real availability, and book without the back-and-forth.',
    url: SITE_URL,
    siteName: 'Vanova',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Vanova | Your AI booking receptionist',
    description:
      'Appointment booking that answers customers, checks real availability, and confirms the booking.',
  },
  // Without this, WebKit/Chromium auto-detect date/time-looking text
  // (e.g. "9 AM-5 PM" in the hours line) and silently style it like a
  // phone-number link - no anchor tag involved, just an odd blue tint
  // with no href behind it.
  other: { 'format-detection': 'telephone=no, date=no' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${outfit.variable}`}>
      <head>
        {/* Material Symbols Outlined - the admin shell's icon set, adopted
            from the Stitch-generated dashboard design (see components/Icon.tsx
            for the small wrapper every admin icon now goes through). A real
            Google Font link, not next/font/google - that helper is built for
            text fonts, not a ligature-based icon font like this one.
            eslint's no-page-custom-font rule flags this ("will only load
            for a single page") - a known false positive here, predating
            App Router: this IS the root layout, rendered for every route
            in the app, the direct App Router equivalent of the
            pages/_document.js placement that rule actually wants. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* The Naira sign (U+20A6) fix (see app/globals.css's 'Noto Sans'
            font-stack entries) went out first as a local()-based
            @font-face pointing at an OS-installed font - looked right on
            desktop, still broken live on mobile Chrome. Real cause:
            mobile browsers commonly refuse to resolve local() at all (a
            documented fingerprinting mitigation - it can reveal exactly
            which fonts are installed), so that fallback silently loaded
            nothing there and the browser fell through to the next font
            in the stack, which doesn't have the glyph either. This is
            the actual fix: a real hosted font file, not a guess about
            what's on the device. Google's `text=` parameter subsets the
            font to only the one requested character, so this is a ~1KB
            request per weight, not a real font download - safe to keep
            in the stack unconditionally. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&text=%E2%82%A6&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
