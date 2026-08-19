import { requireStaffSession } from '@/lib/requireStaffSession';
import AssistantChat from '@/components/AssistantChat';

const SUGGESTIONS = [
  "I'm out sick tomorrow 9am to 1pm",
  "Block off next Tuesday 2pm to 5pm",
  "Closed for a public holiday on the 25th",
];

export default async function ScheduleAssistantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business } = await requireStaffSession(slug);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Ask
        </div>
        <h1 className="font-display text-h1 text-ink">Schedule assistant</h1>
        <p className="text-ink-soft text-body-sm mt-1">
          Tell it when you need time blocked off — it moves affected bookings and messages customers for you.
        </p>
      </div>

      <AssistantChat
        slug={slug}
        endpoint="/api/schedule-assistant/chat"
        emptyStateText={`Tell it when you need to block off for ${business.name}, and it'll work out where everyone affected should move to.`}
        suggestions={SUGGESTIONS}
        inputPlaceholder="e.g. I need tomorrow afternoon off"
        banner={
          <div className="rounded-xl bg-warm-surface px-4 py-3 mb-4 flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
            </svg>
            <p className="text-ink-soft text-caption leading-relaxed">
              It'll always show you exactly who's affected and their new times before moving anything or messaging
              a single customer — nothing happens until you say yes.
            </p>
          </div>
        }
      />
    </div>
  );
}
