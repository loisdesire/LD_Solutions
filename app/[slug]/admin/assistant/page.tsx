import { requireStaffSession } from '@/lib/requireStaffSession';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import AssistantChat from '@/components/AssistantChat';
import Link from 'next/link';

const SUGGESTIONS_CORE = [
  "I'm out sick tomorrow 9am to 1pm",
  'Move Ada to Monday',
  'Block off next Tuesday afternoon',
];

const SUGGESTIONS_FULL = [
  "I'm out sick tomorrow 9am to 1pm",
  'How much did I make this month?',
  'Who are my top customers?',
  'When am I busiest?',
];

export default async function AssistantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
        suggestions={analyticsEnabled ? SUGGESTIONS_FULL : SUGGESTIONS_CORE}
        inputPlaceholder={analyticsEnabled ? 'Ask anything, or say what to move' : 'e.g. I need tomorrow afternoon off'}
        banner={
          <div className="rounded-xl bg-warm-surface px-4 py-3 mb-4 flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" className="shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
            </svg>
            <p className="text-ink-soft text-caption leading-relaxed">
              Before it moves anything it shows you exactly who is affected and their new times. Nothing changes
              until you say yes.
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
