import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Vanova collects, uses, and protects data for business owners and their customers.',
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = 'August 23, 2026';

// Grounded in what the app actually does - every claim below is checked
// against the real data flows in this codebase (Supabase for storage/
// auth, Resend for email, OpenAI for the AI receptionist, Paystack for
// customer payments, Flutterwave for platform billing, Telegram/Meta for
// the optional chat channels) rather than generic boilerplate. Company
// registration details (legal entity, registered address, governing
// jurisdiction, a real contact address) are marked [TODO] rather than
// invented - those are facts only the business owner has, and a
// plausible-sounding fake one is worse than an honest placeholder here.
// This should get a real legal review before being treated as binding;
// it's a genuine, accurate starting point, not a final document.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Vanova" className="h-8 w-8 shrink-0 object-contain" />
            <span className="text-[15px] font-semibold text-ink tracking-tight">Vanova</span>
          </Link>
          <Link href="/" className="text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors">
            Back home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 sm:py-16">
        <p className="text-[13px] font-semibold text-accent mb-2">Legal</p>
        <h1 className="font-display text-[32px] font-semibold text-ink tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-body-sm text-ink-faint mb-10">Last updated {LAST_UPDATED}</p>

        <Prose>
          <p>
            This policy explains what information Vanova collects, why, and what happens to it. It covers two
            different people at once: the business owners who run their booking page on Vanova, and the customers
            who book appointments through one of those pages. Where the answer differs between the two, it says so.
          </p>

          <h2>What we collect</h2>
          <p>
            <strong>From a business owner:</strong> your name, email address, and password (handled by our
            authentication provider, Supabase - we never see or store your raw password), your business profile
            (business name, description, logo, cover photo, contact details, opening hours), and anything you
            connect on purpose: a Paystack account for taking payments, a Telegram bot, a WhatsApp Business number,
            or a Facebook Page for Messenger.
          </p>
          <p>
            <strong>From a customer booking an appointment:</strong> your name, and whichever contact method you
            book through - phone number, email address, or your Telegram/WhatsApp/Messenger identifier - plus the
            service and time you booked. If the business requires payment to confirm, your payment is handled
            entirely by Paystack; we never receive or store your card details.
          </p>
          <p>
            <strong>From anyone using the AI chat</strong> on a business's booking page or through Telegram/WhatsApp/
            Messenger: the messages you send, so the assistant can check availability and complete a booking.
          </p>

          <h2>How it's used</h2>
          <ul>
            <li>To run the actual product: showing your booking page, checking availability, confirming appointments, and sending confirmation emails.</li>
            <li>To power the AI receptionist - your messages are sent to our AI provider (OpenAI) to generate a reply; they are not used to train OpenAI's models on our current arrangement.</li>
            <li>To process payments - handled by Paystack (for a business's customer payments) or Flutterwave (for a business's own subscription to Vanova). Neither we nor the other of those two providers ever sees your full card number.</li>
            <li>To send transactional email (booking confirmations, reminders, staff invites) through Resend.</li>
            <li>To improve reliability and fix problems - basic error logging, without which we can't tell when something is actually broken for you.</li>
          </ul>
          <p>We do not sell personal data, to anyone, ever.</p>

          <h2>Who we share it with</h2>
          <p>Only the providers that make the product work, and only what each one needs to do its job:</p>
          <ul>
            <li><strong>Supabase</strong> - database hosting and authentication for every account and booking.</li>
            <li><strong>OpenAI</strong> - powers the AI receptionist's replies.</li>
            <li><strong>Resend</strong> - sends transactional email on our behalf.</li>
            <li><strong>Paystack</strong> - processes a customer's payment to a business, when a business turns that on.</li>
            <li><strong>Flutterwave</strong> - processes a business's own subscription payment to us.</li>
            <li><strong>Telegram / Meta (WhatsApp, Messenger)</strong> - only if a business owner chooses to connect one of these channels, and only for messages sent through that channel.</li>
          </ul>
          <p>
            We may also disclose information if required by law, or to protect the rights, property, or safety of
            Vanova, our users, or the public.
          </p>

          <h2>Cookies and local storage</h2>
          <p>
            We use a session cookie to keep you signed in (set by Supabase Auth) and, on a public booking page's
            chat widget, a random identifier stored in your browser's local storage so a conversation can continue
            if you come back to the same page. Neither is used for advertising or cross-site tracking.
          </p>

          <h2>How long we keep it</h2>
          <p>
            Booking and account data is kept for as long as an account is active, so a business can see its own
            history and a customer can manage their own bookings. If a business owner closes their account, we
            delete their business data within a reasonable period, except where we're required to keep records
            (for example, payment records) for a longer legal or accounting purpose.
          </p>

          <h2>Your rights</h2>
          <p>
            You can ask to see, correct, or delete the personal data we hold about you. A business owner can do
            most of this directly from their dashboard; a customer can do the same from their account, or by
            contacting the business they booked with, or by contacting us directly using the details below.
          </p>

          <h2>Children</h2>
          <p>Vanova is a business tool and isn't directed at children. We don't knowingly collect data from anyone under 18.</p>

          <h2>Changes to this policy</h2>
          <p>If this policy changes in a material way, we'll update the date at the top and, where practical, let account holders know.</p>

          <h2>Contact</h2>
          <p>
            Questions about this policy, or a request about your data: <span className="text-ink-faint">[TODO: real contact email/address for Vanova Hub]</span>.
          </p>
          <p className="text-caption text-ink-faint">
            Operated by Vanova Hub. <span className="italic">[TODO: registered legal entity name, address, and governing jurisdiction - fill in before this page is treated as final; this draft doesn't invent those facts.]</span>
          </p>
        </Prose>
      </main>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-[15px] text-ink-soft leading-relaxed [&_h2]:font-display [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-10 [&_h2]:mb-1 [&_strong]:text-ink [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:leading-relaxed">
      {children}
    </div>
  );
}
