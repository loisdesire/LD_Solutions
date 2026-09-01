'use client';

import { useEffect, useState } from 'react';
import AssistantChat from './AssistantChat';
import { ASSISTANT_SUGGESTIONS_CORE, ASSISTANT_SUGGESTIONS_FULL } from '@/lib/assistantSuggestions';
import { useCloseOnBackButton } from '@/lib/useCloseOnBackButton';
import { useKeyboardSafeInsets } from '@/lib/useKeyboardSafeInsets';

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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Same fix as WebChatWidget: the phone's back button used to fall
  // through to real navigation instead of closing this.
  useCloseOnBackButton(open, () => setOpen(false));

  // Same fix as WebChatWidget: fixed inset-0 doesn't reliably resize for
  // the on-screen keyboard on every mobile browser.
  const keyboardInsets = useKeyboardSafeInsets(open && isMobile);

  // Same reasoning as WebChatWidget: below sm the panel takes over most
  // of the screen instead of sitting as a small corner card, so
  // background scroll gets locked to match while it's open.
  useEffect(() => {
    if (!open) return;
    const isMobile = typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches;
    if (!isMobile) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {/* Was `hidden` below sm once open, relying on the header's own X to
          close instead - on a phone, tapping the exact spot this button
          normally lives had nothing there at all (same bug reported and
          fixed on WebChatWidget's identical FAB). z-[60], above the
          panel's z-50, keeps it reachable floating over the full-screen
          mobile panel; the panel's own input bar reserves clearance at
          its bottom edge (see AssistantChat's bare-mode padding) so
          nothing sits underneath it. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        className="fixed bottom-5 right-5 z-[60] h-14 w-14 rounded-full flex items-center justify-center text-accent-contrast shadow-[0_12px_28px_-8px_var(--accent)] transition-transform hover:scale-105 active:scale-95"
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
        // Below sm: true edge-to-edge takeover (inset-0, square corners)
        // rather than a card with margins - a margined card left gaps at
        // the top/bottom where the real page (header, page content) was
        // still visible and legible behind it, which read as broken, not
        // "blurred". Fully opaque and covering the whole viewport, so
        // there's nothing left behind it to blur - no separate backdrop
        // needed. sm and up: unchanged, still the small corner card.
        <div
          role="dialog"
          aria-label={`Assistant for ${businessName}`}
          className="fixed inset-0 sm:inset-x-auto sm:inset-y-auto sm:top-auto sm:bottom-[86px] sm:right-5 sm:w-[calc(100vw-2.5rem)] sm:max-w-sm sm:h-[70vh] sm:max-h-[560px] z-50 rounded-none sm:rounded-2xl bg-surface border-0 sm:border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] overflow-hidden animate-rise flex flex-col"
          style={isMobile && keyboardInsets ? { top: keyboardInsets.top, height: keyboardInsets.height } : undefined}
        >
          {/* Same header shape as WebChatWidget's own panel - a business
              mark + name up front, so it's unambiguous this is a different
              conversation from the customer-facing widget, even though
              nobody ever sees both at once. No close button in here
              anymore either, same fix as WebChatWidget: the floating FAB
              is always visible now (z-[60], reachable over this panel on
              mobile too), so a second, smaller, differently-sized close
              control in the header was redundant rather than a real
              backup. */}
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
