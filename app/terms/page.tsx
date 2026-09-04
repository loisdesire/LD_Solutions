import Link from 'next/link';
import type { Metadata } from 'next';
import { PLAN_PRICE_NGN, PLAN_LABEL } from '@/lib/subscription';
import { formatMoney } from '@/lib/formatMoney';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern using Vanova to run or book appointments.',
  alternates: { canonical: '/terms' },
};

const LAST_UPDATED = 'August 31, 2026';

// Same grounding rule as privacy/page.tsx: every concrete claim here
// (pricing, trial length, what payment providers actually handle) is
// checked against the real code (lib/subscription.ts, the signup flow,
// BookingForm's payment path) rather than generic SaaS boilerplate.
// Contact email and jurisdiction are real, confirmed with the business
// owner. No registered legal entity/address yet - Vanova Hub isn't
// incorporated as of this writing, so this deliberately doesn't claim
// one. Real legal review still recommended before this is treated as
// binding.
export default function TermsPage() {
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
        <h1 className="font-display text-[32px] font-semibold text-ink tracking-tight mb-2">Terms of Service</h1>
        <p className="text-body-sm text-ink-faint mb-10">Last updated {LAST_UPDATED}</p>

        <Prose>
          <p>
            These terms cover two kinds of people: business owners who sign up to run their booking page on
            Vanova, and their customers who book appointments through it. By creating a business account, or by
            booking an appointment through a Vanova-powered page, you agree to these terms.
          </p>

          <h2>What Vanova is</h2>
          <p>
            {/* "where enabled" was technically true but read as "pick one, it
                just works" - the Channels page itself labels WhatsApp/
                Messenger "Coming soon" (pending Meta's own review, not
                something a business can turn on today), so this said more
                than was actually available, the same gap the marketing
                homepage's own hero deliberately avoids for the same reason. */}
            Vanova is a booking platform for appointment-based businesses. It gives a business a public booking
            page, an AI receptionist that can answer questions and take bookings on that page and via Telegram
            (WhatsApp and Facebook Messenger are coming soon), and a dashboard to manage appointments, customers,
            staff, and payments.
          </p>

          <h2>Business accounts</h2>
          <ul>
            <li>You need to give accurate information when you sign up, and keep your login secure - you're responsible for what happens under your account.</li>
            <li>New accounts start on a 14-day free trial. After the trial, continued access requires an active paid plan ({PLAN_LABEL.core} at {formatMoney(PLAN_PRICE_NGN.core)}/month, or {PLAN_LABEL.business_intelligence} at {formatMoney(PLAN_PRICE_NGN.business_intelligence)}/month), billed monthly through Flutterwave. You can cancel any time from your dashboard; cancelling stops future billing but doesn't refund the current period - see <Link href="/refunds" className="text-ink-soft hover:text-ink underline underline-offset-2">Cancellations & Refunds</Link> for details.</li>
            <li>If you turn on payments for your customers, that's handled through your own Paystack account, which you connect and control - Vanova never holds your customers' money.</li>
            <li>You can invite staff to help manage your business. What a staff member can and can't do is described in the product itself; you're responsible for who you invite.</li>
            <li>You're responsible for the content on your booking page (business description, photos, service listings) being accurate and something you have the right to use.</li>
          </ul>

          <h2>Customer bookings</h2>
          <ul>
            <li>Booking an appointment doesn't require creating a Vanova account - your name and contact details are shared with the business you're booking, so they can honor the appointment.</li>
            <li>If a business requires payment or a deposit to confirm a booking, that payment goes to the business through Paystack, subject to that business's own cancellation window, not a Vanova-wide policy - see <Link href="/refunds" className="text-ink-soft hover:text-ink underline underline-offset-2">Cancellations & Refunds</Link> for how that works.</li>
            <li>You can manage, reschedule, or cancel your own booking using the link sent at confirmation, or by signing in with the email or phone number you booked with.</li>
            <li>If your payment succeeds but the time slot is lost before it's confirmed (a rare timing conflict), the business is notified and will help sort it out - offering the next available time or a refund - rather than you being asked to simply pay again.</li>
            <li>A dispute over a booking or a charge is between you and the business you booked with. Vanova may help pass along messages between you, but isn't the business and doesn't decide the outcome.</li>
          </ul>

          <h2>The AI receptionist</h2>
          <p>
            The assistant answers questions and can create, move, or cancel bookings based on what you tell it. It
            checks real availability before confirming anything. It's automated - if something looks wrong with a
            booking it made, contact the business directly to sort it out.
          </p>

          <h2>Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use Vanova for a business that's illegal, or to book an appointment in bad faith (spam bookings, harassment, fraud).</li>
            <li>Try to break, overload, or gain unauthorized access to any part of the platform or another account.</li>
            <li>Resell or white-label Vanova without our agreement.</li>
          </ul>
          <p>We can suspend or close an account that violates these terms.</p>

          <h2>Payments</h2>
          <p>
            All payment processing - a customer paying a business, or a business paying its Vanova subscription -
            is handled by Paystack or Flutterwave respectively, not by us directly. Their own terms and any
            transaction fees apply on top of this agreement.
          </p>

          <h2>Availability and changes</h2>
          <p>
            We aim to keep Vanova available and reliable, but don't guarantee it will always be free of downtime
            or errors. Features may change, be added, or be removed as the product develops; we'll try to give
            reasonable notice for anything that materially reduces what an existing plan already includes.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            Vanova is provided as-is. To the fullest extent the law allows, we aren't liable for indirect,
            incidental, or consequential damages arising from using the platform - lost bookings, lost revenue, or
            similar - beyond what's required by applicable law.
          </p>

          <h2>Changes to these terms</h2>
          <p>If these terms change materially, we'll update the date at the top and, where practical, let account holders know.</p>

          <h2>Contact</h2>
          <p>
            Questions about these terms: <a href="mailto:vanovahub@gmail.com">vanovahub@gmail.com</a>.
          </p>
          <p className="text-caption text-ink-faint">
            Operated by Vanova Hub, based in Nigeria and governed by the laws of the Federal Republic of Nigeria.
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
