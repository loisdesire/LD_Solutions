import { requireStaffSession } from '@/lib/requireStaffSession';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import AssistantChat from '@/components/AssistantChat';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Assistant' };

// Grouped, not one flat list - "Move Ada to Monday" and "Who are my top
// customers?" are different kinds of ask (one changes something, one
// doesn't), even though they go to the same thread. See AssistantChat.tsx
// for why this stays one assistant rather than two separate tools.
const GROUPS_CORE = [
  {
    label: 'Change something',
    items: ["I'm out sick tomorrow 9am to 1pm", 'Move Ada to Monday', 'Block off next Tuesday afternoon'],
  },
];

const GROUPS_FULL = [
  { label: 'Ask', items: ['How much did I make this month?', 'Who are my top customers?', 'When am I busiest?'] },
  { label: 'Change something', items: ["I'm out sick tomorrow 9am to 1pm"] },
];

export default async function AssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  // Lets the dashboard hand a question straight over, so asking from there
  // lands on the answer rather than on an empty chat.
  const { q } = await searchParams;
  const { business } = await requireStaffSession(slug);
  const analyticsEnabled = await hasBusinessIntelligence(business.id);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">Ask</div>
        <h1 className="font-display text-h1 text-ink">Assistant</h1>
        <p className="text-ink-soft text-body-sm mt-1">
          {analyticsEnabled
            ? 'Ask about your bookings and numbers, or tell it to move appointments around.'
            : 'Tell it when you need time blocked off, or an appointment moved.'}
        </p>
      </div>

      <AssistantChat
        slug={slug}
        endpoint="/api/assistant/chat"
        emptyStateText={
          analyticsEnabled
            ? `Ask ${business.name} anything, or tell it what needs moving.`
            : `Tell it what needs moving and it will work out where everyone affected should go.`
        }
        suggestionGroups={analyticsEnabled ? GROUPS_FULL : GROUPS_CORE}
        initialMessage={q?.slice(0, 500)}
        inputPlaceholder={analyticsEnabled ? 'Ask anything, or say what to move' : 'e.g. I need tomorrow afternoon off'}
        banner={
          // A trust feature, not a small disclaimer - this is the one
          // sentence standing between "just answering" and "about to
          // change someone's appointment", so it gets a stronger border
          // and a fixed home above the chat rather than blending into the
          // warm-surface backgrounds used everywhere else on the page.
          <div className="rounded-xl bg-surface border-2 border-line px-4 py-3 mb-4 flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" className="shrink-0 mt-0.5" aria-hidden="true">
              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <p className="text-ink text-caption leading-relaxed">
              <span className="font-semibold">Nothing changes until you say yes.</span> Before it moves anything, it
              shows you exactly who is affected and their new times, first.
              {!analyticsEnabled && (
                <>
                  {' '}
                  Want it to answer questions about revenue and customers too?{' '}
                  <Link href={`/${slug}/admin/billing`} className="font-semibold underline underline-offset-2" style={{ color: 'var(--accent)' }}>
                    See Business Intelligence
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        }
      />
    </div>
  );
}
