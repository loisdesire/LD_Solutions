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
      <body>{children}</body>
    </html>
  );
}
