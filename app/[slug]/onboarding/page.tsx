import Link from 'next/link';
import type { Metadata } from 'next';
import { requireStaffSession } from '@/lib/requireStaffSession';
import { getOnboardingProgress } from '@/lib/onboardingProgress';
import { getAssistantHistory } from '@/lib/assistantHistory';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import AuthMark from '@/components/AuthMark';
import OnboardingChat from '@/components/OnboardingChat';

// Private, staff-only, and exists for exactly one moment in a business's
// life - never indexed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  return {
    title: data ? `Get started - ${data.business.name}` : 'Get started',
    robots: { index: false, follow: false },
  };
}

// The dedicated first-time setup conversation - reached once, straight off
// signup (see app/signup/page.tsx), instead of the dashboard. Deliberately
// its own route outside app/[slug]/admin rather than a page inside that
// layout: the full sidebar's dozen destinations mean nothing yet to someone
// who hasn't set up a single service, and showing it all before they've
// finished this would just be noise around the one thing they actually
// need right now. requireStaffSession is called directly here instead
// (same as the admin layout does), so this still gets the same
// auth/trial/demo checks with none of the chrome.
//
// requireOwner: true - a staff member invited later has nothing to
// onboard, the business already exists by the time they'd ever see this
// link. skipSubscriptionCheck isn't needed: signup starts a 14-day trial
// immediately, so a business landing here is always inside it.
export default async function OnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, staff } = await requireStaffSession(slug, { requireOwner: true });
  const [progress, history] = await Promise.all([
    getOnboardingProgress(business.id, slug),
    getAssistantHistory(business.id, staff.id, 'onboarding'),
  ]);

  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="flex items-start justify-between gap-4 mb-8">
          <AuthMark name={business.name} label="Getting started" logoUrl={business.logo_url} />
          {/* Always visible, never buried - leaving mid-setup lands on the
              exact same dashboard every other business sees, badge and
              SetupChecklist doing their normal job. Nobody is trapped here. */}
          <Link
            href={`/${slug}/admin`}
            className="text-[13px] font-medium text-ink-faint hover:text-ink transition-colors shrink-0 mt-1"
          >
            Skip for now
          </Link>
        </div>

        <h1 className="font-display text-[26px] sm:text-[30px] leading-[1.15] mb-2">
          Let&rsquo;s set up your booking page
        </h1>
        <p className="text-ink-soft text-[14.5px] mb-7 max-w-md">
          Answer a few questions here - no forms. Say as much or as little as you want in each message.
        </p>

        <OnboardingChat slug={slug} businessName={business.name} initialProgress={progress} initialMessages={history} />
      </div>
    </main>
  );
}
