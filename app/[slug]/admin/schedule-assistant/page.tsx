import { requireStaffSession } from '@/lib/requireStaffSession';
import AssistantChat from '@/components/AssistantChat';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Schedule' };

// Split back out of the merged /admin/assistant - see insights/page.tsx
// for the reasoning. Ungated (unlike Insights): this automates something
// every plan can already do by hand from the Calendar page, so it isn't
// a paid analytics feature, it's operational convenience.
const SUGGESTIONS = [
  {
    label: 'Change something',
    items: ["I'm out sick tomorrow 9am to 1pm", 'Move Ada to Monday', 'Block off next Tuesday afternoon'],
  },
];

export default async function ScheduleAssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  await requireStaffSession(slug);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">Automate</div>
        <h1 className="font-display text-h1 text-ink">Manage my schedule</h1>
        <p className="text-ink-soft text-body-sm mt-1">Tell it when you need time blocked off, or an appointment moved.</p>
      </div>

      <AssistantChat
        slug={slug}
        endpoint="/api/schedule-assistant/chat"
        emptyStateText="Tell it what needs moving and it will work out where everyone affected should go."
        suggestionGroups={SUGGESTIONS}
        initialMessage={q?.slice(0, 500)}
        inputPlaceholder="e.g. I need tomorrow afternoon off"
        banner={
          // A trust feature, not a small disclaimer - the one sentence
          // standing between "just asking" and "about to change someone's
          // appointment", so it gets a stronger border and a fixed home
          // above the chat instead of blending into the page.
          <div className="rounded-xl bg-surface border-2 border-line px-4 py-3 mb-4 flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" className="shrink-0 mt-0.5" aria-hidden="true">
              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <p className="text-ink text-caption leading-relaxed">
              <span className="font-semibold">Nothing changes until you say yes.</span> Before it moves anything, it
              shows you exactly who is affected and their new times, first.
            </p>
          </div>
        }
      />
    </div>
  );
}
