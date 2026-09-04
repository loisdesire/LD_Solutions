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
  // Desktop-only escape hatch for a real conversation that outgrows the
  // small corner card - mobile already gets the equivalent full-viewport
  // treatment automatically (isFullScreen below), it just never had a
  // manual toggle since there was nothing to toggle FROM there. Resets on
  // close so reopening always starts as the small card, not stuck expanded
  // from last time.
  const [expanded, setExpanded] = useState(false);
  const isFullScreen = isMobile || expanded;

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

  // Shared so the header's own back button (mobile, added below) fires
  // the exact same close as the FAB - same reasoning as WebChatWidget's
  // identical toggleOpen.
  function toggleOpen() {
    setOpen((v) => {
      if (v) setExpanded(false);
      return !v;
    });
  }

  return (
    <>
      {/* Hidden on mobile while open now, not "always visible, z-[60]" -
          same fix and same reasoning as WebChatWidget's identical FAB:
          bottom-5 is plain CSS with no idea where the keyboard actually
          is, only the panel itself (useKeyboardSafeInsets) was ever made
          keyboard-aware, so this either rendered past the true visible
          area or left a dead gap reserved for it once the keyboard was
          open. The header's own back button is the sole close control on
          mobile now; unchanged on desktop. */}
      <button
        onClick={toggleOpen}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        className={`fixed bottom-5 right-5 z-[60] h-14 w-14 rounded-full items-center justify-center text-accent-contrast shadow-[0_12px_28px_-8px_var(--accent)] transition-transform hover:scale-105 active:scale-95 ${
          open && isMobile ? 'hidden' : 'flex'
        }`}
        style={{ background: 'var(--accent)' }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          // A fixed sparkle glyph, not the business's own uploaded logo -
          // was rendering an arbitrary logo at 26px on this button, and a
          // logo that reads fine at real size (a detailed illustration, a
          // wide wordmark, colors that don't sit well on a flat accent
          // circle) can look genuinely messy squeezed into an icon this
          // small. No business's logo is under this app's control, so
          // nothing here can guarantee it'll still look clean at icon
          // scale - a fixed mark can. Same sparkle already used for
          // "Assistant" in the sidebar nav (components/AdminSidebar.tsx),
          // so it reads as the same thing in both places rather than two
          // different icons for one feature.
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
          </svg>
        )}
      </button>

      {open && (
        // Below sm: true edge-to-edge takeover (inset-0, square corners)
        // rather than a card with margins - a margined card left gaps at
        // the top/bottom where the real page (header, page content) was
        // still visible and legible behind it, which read as broken, not
        // "blurred". Fully opaque and covering the whole viewport, so
        // there's nothing left behind it to blur - no separate backdrop
        // needed. sm and up: the small corner card, UNLESS expanded - a
        // real conversation (especially one with an attached photo) can
        // genuinely outgrow a 560px-tall corner card; this is the manual
        // version of the same full-viewport treatment mobile already gets
        // automatically, not a new visual language.
        <div
          role="dialog"
          aria-label={`Assistant for ${businessName}`}
          className={
            isFullScreen
              ? 'fixed inset-0 z-50 rounded-none bg-surface border-0 shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] overflow-hidden animate-rise flex flex-col'
              : 'fixed bottom-[86px] right-5 w-[calc(100vw-2.5rem)] max-w-sm h-[70vh] max-h-[560px] z-50 rounded-2xl bg-surface border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] overflow-hidden animate-rise flex flex-col'
          }
          style={isMobile && keyboardInsets ? { top: keyboardInsets.top, height: keyboardInsets.height } : undefined}
        >
          {/* Same header shape as WebChatWidget's own panel - a business
              mark + name up front, so it's unambiguous this is a different
              conversation from the customer-facing widget, even though
              nobody ever sees both at once. A back-style button is back
              here on mobile only, top-left, matching the same fix and the
              same reasoning as WebChatWidget's own - asked for directly,
              and safe to bring back now that useKeyboardSafeInsets keeps
              the header itself correctly positioned. The floating FAB
              stays too, unchanged. */}
          <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-3">
            <button
              onClick={toggleOpen}
              aria-label="Close assistant"
              className="sm:hidden -ml-1.5 h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors shrink-0"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
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
            {/* Desktop only - mobile is already full-screen the moment it's
                open, nothing to toggle there. */}
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Shrink assistant' : 'Expand assistant to full screen'}
              title={expanded ? 'Shrink' : 'Expand to full screen'}
              className="hidden sm:flex h-8 w-8 rounded-full items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors shrink-0"
            >
              {expanded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3v4a2 2 0 01-2 2H3M15 3v4a2 2 0 002 2h4M9 21v-4a2 2 0 00-2-2H3M15 21v-4a2 2 0 012-2h4" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
                </svg>
              )}
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
