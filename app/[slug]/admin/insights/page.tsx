import Link from 'next/link';
import { requireStaffSession } from '@/lib/requireStaffSession';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import AssistantChat from '@/components/AssistantChat';

const SUGGESTIONS = [
  'What are my top services?',
  'Who are my top customers?',
  'How much have I made this month?',
  "What's my next appointment?",
];

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business } = await requireStaffSession(slug);

  const unlocked = await hasBusinessIntelligence(business.id);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Ask
        </div>
        <h1 className="font-display text-h1 text-ink">Insights</h1>
        <p className="text-ink-soft text-body-sm mt-1">
          Ask about revenue, top customers, top services, and what's next - in plain language.
        </p>
      </div>

      {unlocked ? (
        <AssistantChat
          slug={slug}
          endpoint="/api/insights/chat"
          emptyStateText={`Ask anything about ${business.name}'s bookings, customers, or revenue.`}
          suggestions={SUGGESTIONS}
          inputPlaceholder="Ask about your business…"
        />
      ) : (
        <div className="border-2 border-dashed border-line rounded-2xl bg-warm-surface p-8 text-center max-w-lg">
          <div
            className="h-11 w-11 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--accent-soft)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
              <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
            </svg>
          </div>
          <h2 className="font-display text-[17px] text-ink mb-1.5">Unlock Insights</h2>
          <p className="text-ink-soft text-body-sm mb-5">
            Upgrade to ask an AI directly about your revenue, top customers, and top services - no spreadsheets.
          </p>
          <Link
            href={`/${slug}/admin/billing`}
            className="inline-flex items-center rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          >
            View plans
          </Link>
        </div>
      )}
    </div>
  );
}
