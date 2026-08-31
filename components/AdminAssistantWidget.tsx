'use client';

import { useEffect, useState } from 'react';
import AssistantChat from './AssistantChat';
import { ASSISTANT_SUGGESTIONS_CORE, ASSISTANT_SUGGESTIONS_FULL } from '@/lib/assistantSuggestions';

type Message = { role: 'user' | 'assistant'; content: string };

// The assistant, everywhere - not just the dashboard. Mounted once in
// app/[slug]/admin/layout.tsx, so it's the same floating entry point on
// Services, Calendar, Settings, every admin page, exactly the way
// WebChatWidget already works for customers on the public site. Replaces
// the old dashboard-only AskAssistantBar, which meant leaving Services (or
// anywhere else) just to ask something.
//
// Reuses AssistantChat itself (bare, so this widget supplies the outer
// card chrome instead of AssistantChat's own) - same endpoint, same
// history, same everything as the full /admin/assistant page. Opening
// either one shows the identical, continuing conversation.
export default function AdminAssistantWidget({
  slug,
  businessName,
  logoUrl,
  analyticsEnabled,
  initialMessages,
}: {
  slug: string;
  businessName: string;
  logoUrl?: string | null;
  analyticsEnabled: boolean;
  initialMessages?: Message[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full flex items-center justify-center text-accent-contrast shadow-[0_12px_28px_-8px_var(--accent)] transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'var(--accent)' }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : logoUrl ? (
          <img src={logoUrl} alt="" className="h-[26px] w-[26px] object-contain" />
        ) : (
          <span className="font-display text-[18px] font-bold">{businessName?.[0]?.toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Assistant for ${businessName}`}
          className="fixed bottom-[86px] right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[70vh] max-h-[560px] rounded-2xl bg-surface border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] overflow-hidden animate-rise flex flex-col"
        >
          {/* Same header shape as WebChatWidget's own panel - a business
              mark + name up front, so it's unambiguous this is a different
              conversation from the customer-facing widget, even though
              nobody ever sees both at once. */}
          <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover shrink-0 border border-line" />
            ) : (
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-display text-[14px] font-bold text-accent-contrast" style={{ background: 'var(--accent)' }}>
                {businessName?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink truncate">Assistant</p>
              <p className="text-[10.5px] text-ink-faint truncate">{businessName}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="h-7 w-7 rounded-full flex items-center justify-center text-ink-faint hover:bg-warm-surface hover:text-ink transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <AssistantChat
              slug={slug}
              endpoint="/api/assistant/chat"
              emptyStateText={
                analyticsEnabled
                  ? `Ask ${businessName} anything, or tell it what needs moving.`
                  : `Tell it what needs moving and it will work out where everyone affected should go.`
              }
              suggestionGroups={analyticsEnabled ? ASSISTANT_SUGGESTIONS_FULL : ASSISTANT_SUGGESTIONS_CORE}
              inputPlaceholder={analyticsEnabled ? 'Ask anything, or say what to move' : 'e.g. I need tomorrow afternoon off'}
              initialMessages={initialMessages}
              bare
            />
          </div>
        </div>
      )}
    </>
  );
}
