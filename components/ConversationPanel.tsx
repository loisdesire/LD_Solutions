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
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Customer conversation" ref={dialogRef}>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-[13px] text-ink-faint">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No messages yet. When this customer messages your assistant, the conversation appears here.</p>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-left' : 'text-right'}>
                <div
                  // whitespace-pre-wrap matters here - bot replies routinely
                  // contain line breaks (lists, multi-line confirmations),
                  // and without it every line just runs together into one
                  // block, which is what "jumbled up" actually was.
                  className={`inline-block rounded-md px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap max-w-[85%] text-left ${
                    m.role === 'user' ? 'bg-accent-soft text-ink' : 'bg-accent text-white'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Same inline pill pattern as ProductFinder's compose bar, not a
            stacked textarea+button - consistent with the rest of the app. */}
        <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-line shrink-0">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply as your business…"
            className="flex-1 rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="rounded-md bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
        {error && <p className="text-[12px] text-error px-4 pb-3">{error}</p>}
      </div>
    </div>
  );
}
