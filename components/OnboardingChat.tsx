'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AssistantChat from './AssistantChat';

export type OnboardingProgress = {
  profileDone: boolean;
  servicesDone: boolean;
  hoursDone: boolean;
  allDone: boolean;
  slug: string;
};

const STEPS: { key: keyof OnboardingProgress; label: string }[] = [
  { key: 'profileDone', label: 'Profile' },
  { key: 'servicesDone', label: 'Services' },
  { key: 'hoursDone', label: 'Hours' },
];

function StepDot({ done }: { done: boolean }) {
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full shrink-0 transition-colors"
      style={done ? { background: 'var(--accent)' } : undefined}
      aria-hidden="true"
    >
      {done ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <span className="h-2 w-2 rounded-full bg-line-strong" />
      )}
    </span>
  );
}

// The checklist banner sitting above the onboarding chat (see
// AssistantChat's `banner` prop) - a live readout of the exact three
// signals lib/onboardingProgress.ts computes, so what the owner sees here
// can never say "done" while the dashboard's own badge still disagrees.
// Updates the moment a tool call actually saves something (via
// AssistantChat's onReplyData), not just when the page reloads.
export default function OnboardingChat({
  slug,
  businessName,
  initialProgress,
}: {
  slug: string;
  businessName: string;
  initialProgress: OnboardingProgress;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initialProgress);
  const [copied, setCopied] = useState(false);

  const bookingUrl = typeof window !== 'undefined' ? `${window.location.origin}/${slug}` : `/${slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <AssistantChat
        slug={slug}
        endpoint="/api/onboarding/chat"
        emptyStateText={`Let's get ${businessName} ready to take bookings.`}
        suggestionGroups={[]}
        inputPlaceholder="Type your answer…"
        initialMessage="Hi! I just signed up."
        onReplyData={(data) => {
          if (data.progress) setProgress(data.progress as OnboardingProgress);
        }}
        banner={
          <div className="mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              {STEPS.map((step) => (
                <div key={step.key} className="flex items-center gap-1.5">
                  <StepDot done={Boolean(progress[step.key])} />
                  <span className={`text-[13px] font-medium ${progress[step.key] ? 'text-ink' : 'text-ink-faint'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {progress.allDone && (
              <div className="mt-4 rounded-2xl border-2 border-line bg-accent-soft p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-rise">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[16px]" style={{ color: 'var(--accent)' }}>
                    Your booking page is ready
                  </p>
                  <p className="font-mono text-[12.5px] text-ink-soft truncate mt-0.5">{bookingUrl}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopy}
                    className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-warm-surface transition-colors"
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <button
                    onClick={() => router.push(`/${slug}/admin`)}
                    className="rounded-full bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-contrast hover:opacity-90 transition-all"
                  >
                    Go to dashboard →
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
