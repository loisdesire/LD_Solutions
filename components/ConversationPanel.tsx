'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialog } from './useDialog';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function ConversationPanel({
  slug,
  customerPhone,
  customerLabel,
  onClose,
}: {
  slug: string;
  customerPhone: string;
  customerLabel: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const cancelledRef = useRef(false);

  // Only Supabase reads here - no OpenAI/Twilio/Telegram calls - so polling
  // costs nothing beyond ordinary database usage. Still kept to a modest
  // interval, paused while the tab isn't visible, and stopped entirely on
  // unmount - not out of cost concern, just no reason to hammer it.
  const load = useCallback(
    async (isFirstLoad: boolean) => {
      if (document.hidden && !isFirstLoad) return;
      if (isFirstLoad) setLoading(true);
      const res = await fetch(
        `/api/admin/message-customer?slug=${encodeURIComponent(slug)}&customerPhone=${encodeURIComponent(customerPhone)}`
      );
      const data = await res.json();
      if (!cancelledRef.current) {
        setMessages(res.ok ? data.messages ?? [] : []);
        if (isFirstLoad) setLoading(false);
      }
    },
    [slug, customerPhone]
  );

  useEffect(() => {
    cancelledRef.current = false;
    load(true);
    const interval = setInterval(() => load(false), 4000);
    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [load]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');

    const res = await fetch('/api/admin/message-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, customerPhone, message: text }),
    });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to send.');
      return;
    }

    setText('');
    // Refetch the authoritative history rather than manually patching local
    // state - the server just persisted this exact message, so there's no
    // reason to keep two separate copies of "what was said" in sync by hand.
    load(false);
  }

  const dialogRef = useDialog(true, onClose);


  return (
    // z-[70], not the z-50 this had before - AdminAssistantWidget's own
    // floating launcher sits at z-[60], which meant that button rendered
    // ON TOP of this panel's backdrop while it was open, visible and
    // clickable through what should have been a full-screen modal.
    // Confirmed live: "why is the assistant thing on the bottom buttons"
    // while this panel was open - that FAB poking through.
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Customer conversation" ref={dialogRef}>
      <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--ink) 20%, transparent)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface h-full flex flex-col shadow-soft border-l border-line">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="font-display text-[17px] truncate">{customerLabel}</p>
            <p className="font-mono text-[10.5px] text-ink-faint mt-0.5">Conversation with your assistant</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-ink-faint hover:text-ink transition-colors shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* overscroll-contain - same fix as the standalone chat panels. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-[13px] text-ink-faint">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No messages yet. When this customer messages your assistant, the conversation appears here.</p>
          ) : (
            // Same bubble shape/palette as WebChatWidget.tsx and
            // AssistantChat.tsx now - this panel was a fully separate,
            // older component reused as-is for this feature, never
            // restyled to match: rounded-md instead of rounded-2xl with a
            // tail corner, and the assistant/business side carrying the
            // bold solid accent fill instead of the soft neutral every
            // other chat surface in this app uses for an outgoing reply.
            // Alignment direction stays as it was - customer on the left,
            // your own business's replies on the right - which is the
            // sensible way round for a STAFF member reading their own
            // outbound conversation, unlike the customer-facing widgets
            // where "user" (the customer) is on the right instead.
            messages.map((m, i) => (
              <div key={i} className={`flex animate-rise ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  // whitespace-pre-wrap matters here - bot replies routinely
                  // contain line breaks (lists, multi-line confirmations),
                  // and without it every line just runs together into one
                  // block, which is what "jumbled up" actually was.
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-left ${
                    m.role === 'user' ? 'bg-warm-surface text-ink rounded-bl-md' : 'bg-accent-soft text-ink rounded-br-md'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Same pill-composer shape as WebChatWidget.tsx now, not the
            separate bordered-input + text-label-button pair this had
            before - the one visibly different composer among this app's
            chat surfaces. */}
        <div className="shrink-0 border-t border-line p-3">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2.5 rounded-2xl bg-paper border border-line pl-4 pr-2 py-2.5 focus-within:border-[var(--accent)] transition-colors"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Reply as your business"
              placeholder="Reply as your business…"
              className="flex-1 bg-transparent border-none outline-none focus:outline-none text-[14px] text-ink placeholder-ink-faint"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send"
              className="h-9 w-9 rounded-full flex items-center justify-center text-accent-contrast shrink-0 transition-all active:scale-90 disabled:opacity-30"
              style={{ background: 'var(--accent)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
        </div>
        {error && <p className="text-[12px] text-error px-4 pb-3">{error}</p>}
      </div>
    </div>
  );
}
