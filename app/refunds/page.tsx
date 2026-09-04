import Link from 'next/link';
import type { Metadata } from 'next';
import { PLAN_PRICE_NGN, PLAN_LABEL } from '@/lib/subscription';
import { formatMoney } from '@/lib/formatMoney';

export const metadata: Metadata = {
  title: 'Cancellations & Refunds',
  description: 'What happens when a business subscription or a customer booking is cancelled on Vanova.',
  alternates: { canonical: '/refunds' },
};

const LAST_UPDATED = 'September 4, 2026';

// Same grounding rule as terms/page.tsx and privacy/page.tsx: every claim
// here is checked against the real code, not written as generic SaaS
// boilerplate. In particular - there's no automated refund flow anywhere
// in this codebase (a cancellation just marks a booking `cancelled`;
// nothing touches Paystack to reverse a charge), so this doesn't promise
// one. What's real and already enforced server-side (app/api/bookings/
// [id]/cancel/route.ts) is the per-business cancellation window - this
// page explains that mechanism plainly rather than inventing a refund
// guarantee the product doesn't back up. Real legal review still
// recommended before this is treated as binding, same caveat as the
// other two legal pages.
export default function RefundsPage() {
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
        <h1 className="font-display text-[32px] font-semibold text-ink tracking-tight mb-2">Cancellations & Refunds</h1>
        <p className="text-body-sm text-ink-faint mb-10">Last updated {LAST_UPDATED}</p>

        <Prose>
          <p>
            This covers two different charges: a business&rsquo;s own Vanova subscription, and a customer paying to
            book an appointment through a Vanova-powered page. They work differently, and are explained separately
            below.
          </p>

          <h2>Your Vanova subscription</h2>
          <ul>
            <li>Every new account starts on a 14-day free trial - nothing is charged during the trial.</li>
            <li>
              After the trial, staying on {PLAN_LABEL.core} ({formatMoney(PLAN_PRICE_NGN.core)}/month) or{' '}
              {PLAN_LABEL.business_intelligence} ({formatMoney(PLAN_PRICE_NGN.business_intelligence)}/month) bills
              monthly through Flutterwave.
            </li>
            <li>You can cancel any time from your dashboard. Cancelling stops future billing immediately - it doesn&rsquo;t refund the period you&rsquo;re already in.</li>
            <li>We don&rsquo;t offer partial-month refunds for unused time. If a charge failed to process correctly on our end, contact us and we&rsquo;ll sort it out.</li>
          </ul>

          <h2>A customer&rsquo;s booking</h2>
          <p>
            This is the one worth understanding clearly, because it isn&rsquo;t Vanova-wide - it&rsquo;s set by each
            business individually.
          </p>
          <ul>
            <li>
              Every business sets its own free cancellation window (how many hours before an appointment a customer
              can still cancel or reschedule at no cost). That number is shown to the customer at booking and on
              their confirmation - and it&rsquo;s enforced automatically: a cancellation attempt inside that window is
              declined, not just discouraged.
            </li>
            <li>
              If a business requires payment or a deposit to confirm a booking, that money goes directly to the
              business&rsquo;s own Paystack account. Vanova never holds it, and doesn&rsquo;t automatically reverse or
              refund a charge on a customer&rsquo;s behalf.
            </li>
            <li>
              That means a refund for a cancelled booking, a late cancellation, or a no-show is a decision the
              business makes directly with their customer, the same way it would be if they took bookings any other
              way - not something Vanova adjudicates or processes automatically.
            </li>
            <li>
              The one exception: if a customer&rsquo;s payment succeeds but the time slot is lost before the booking
              is confirmed (a rare timing conflict, not a cancellation), the business is notified and will help sort
              it out - offering the next available time or a refund - rather than the customer being asked to simply
              pay again.
            </li>
          </ul>
          <p>
            If you&rsquo;re a business owner: your customers can see your cancellation window right on your booking
            page, so this doubles as the honest answer to &ldquo;what happens if someone cancels or doesn&rsquo;t
            show&rdquo; - it&rsquo;s the window you&rsquo;ve set, and any refund from there is between you and them,
            same as it would be off-platform.
          </p>

          <h2>Disputes</h2>
          <p>
            A disagreement over a specific booking or charge is between the customer and the business they booked
            with. Vanova may help pass along messages between the two, but isn&rsquo;t the business and doesn&rsquo;t
            decide the outcome - see the{' '}
            <Link href="/terms" className="text-ink-soft hover:text-ink underline underline-offset-2">Terms of Service</Link>.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about a Vanova subscription charge: <a href="mailto:vanovahub@gmail.com">vanovahub@gmail.com</a>.
            Questions about a specific booking or payment to a business: contact that business directly - they're
            the ones who received it.
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
