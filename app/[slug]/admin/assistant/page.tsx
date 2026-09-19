import { requireStaffSession } from '@/lib/requireStaffSession';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import { getAssistantHistory } from '@/lib/assistantHistory';
import { ASSISTANT_SUGGESTIONS_CORE, ASSISTANT_SUGGESTIONS_FULL } from '@/lib/assistantSuggestions';
import AssistantChat from '@/components/AssistantChat';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Assistant' };

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
  const { business, staff } = await requireStaffSession(slug);
  const [analyticsEnabled, history] = await Promise.all([
    hasBusinessIntelligence(business.id),
    getAssistantHistory(business.id, staff.id, 'assistant'),
  ]);

  // The eyebrow/title/subtitle header and the "Nothing changes until you
  // say yes" trust banner both used to sit above the chat - confirmed
  // live as unwanted: on a page whose entire job is this one chat
  // interface, restating what it does before showing it just pushed the
  // actual tool down and made the page read as mostly empty space around
  // a small boxed card. The reassurance itself moved into the Skills
  // panel's own copy instead of a permanent banner - still communicated,
  // just not paid for in vertical space on every visit.
  return (
    <AssistantChat
      slug={slug}
      endpoint="/api/assistant/chat"
      emptyStateText={
        analyticsEnabled
          ? `Ask ${business.name} anything, or tell it what needs moving.`
          : `Tell it what needs moving and it will work out where everyone affected should go.`
      }
      suggestionGroups={analyticsEnabled ? ASSISTANT_SUGGESTIONS_FULL : ASSISTANT_SUGGESTIONS_CORE}
      initialMessage={q?.slice(0, 500)}
      initialMessages={history}
      inputPlaceholder={analyticsEnabled ? 'Ask anything, or say what to move' : 'e.g. I need tomorrow afternoon off'}
    />
  );
}
