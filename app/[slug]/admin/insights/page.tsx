import { requireStaffSession } from '@/lib/requireStaffSession';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import AssistantChat from '@/components/AssistantChat';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ask' };

// Split back out of the merged /admin/assistant, per the audit's original
// ask: "ask about my business" and "manage my schedule" read as different
// jobs and shouldn't share one nav item. The merged page (and
// /api/assistant/chat) still exists and still works - this doesn't remove
// it, it gives the nav two clear destinations instead of one ambiguous
// one, for anyone who already knows which kind of thing they want.
const SUGGESTIONS = [
  { label: 'Ask', items: ['How much did I make this month?', 'Who are my top customers?', 'When am I busiest?'] },
];

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const { business } = await requireStaffSession(slug);
  const analyticsEnabled = await hasBusinessIntelligence(business.id);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">Automate</div>
        <h1 className="font-display text-h1 text-ink">Ask about my business</h1>
        <p className="text-ink-soft text-body-sm mt-1">
          Revenue, customers, and how the business is doing - in plain English.
        </p>
      </div>

      {analyticsEnabled ? (
        <AssistantChat
          slug={slug}
          endpoint="/api/insights/chat"
          emptyStateText={`Ask ${business.name} anything about revenue, customers, or bookings.`}
          suggestionGroups={SUGGESTIONS}
          initialMessage={q?.slice(0, 500)}
          inputPlaceholder="Ask anything about your business"
        />
      ) : (
        // The API route hard-gates this on the plan (403), so showing the
        // chat here would just mean every message fails - the honest
        // state is telling them what unlocks it, not a chat box that
        // can't actually answer anything yet.
        <div className="rounded-2xl border-2 border-line bg-surface px-6 py-10 text-center">
          <p className="font-display text-[18px] text-ink mb-1.5">Business Intelligence isn&rsquo;t on your plan yet</p>
          <p className="text-ink-soft text-body-sm max-w-sm mx-auto mb-5">
            Upgrade to ask about revenue, top customers, and trends in plain English - the same booking AI every
            plan already has, plus deeper answers about how the business is doing.
          </p>
          <Link
            href={`/${slug}/admin/billing`}
            className="inline-flex items-center rounded-full px-5 py-2.5 min-h-[44px] text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            See Business Intelligence
          </Link>
        </div>
      )}
    </div>
  );
}
