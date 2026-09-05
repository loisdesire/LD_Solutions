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
        <div className="mb-6">
          <AuthMark name={business.name} label="Getting started" logoUrl={business.logo_url} />
        </div>

        <h1 className="font-display text-[26px] sm:text-[30px] leading-[1.15] mb-7">
          Let&rsquo;s set up your booking page
        </h1>

        {/* "Skip for now" used to live up here, next to AuthMark - findable
            on the very first screen, then gone the moment the conversation
            grew past one screen's worth (confirmed live: a real signup
            reported not seeing any way to reach the dashboard at all).
            Lives inside OnboardingChat's banner now instead, right next to
            the progress steps, which render above the chat on every turn -
            not a one-time header row, so it can't scroll out of reach. */}
        <OnboardingChat slug={slug} businessName={business.name} initialProgress={progress} initialMessages={history} />
      </div>
    </main>
  );
}
