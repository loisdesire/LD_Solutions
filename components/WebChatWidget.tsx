'use client';

import { useEffect, useRef, useState } from 'react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const THINKING_LINES = ['Checking availability…', 'One moment…', 'Almost there…'];

// A random per-visitor id, one per business (a customer browsing two
// different businesses' pages should get two separate conversations, not
// one bleeding into the other) — persisted in localStorage so reopening
// the widget, or coming back later, continues the same thread instead of
// starting over. This is the website's version of the same opaque
// "customerPhone" identifier WhatsApp/Telegram/Messenger already use.
function getSessionId(businessId: string): string {
  const key = `web-chat-session:${businessId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export default function WebChatWidget({
  businessId,
  defaultOpen = false,
}: {
  businessId: string;
  // Set when this widget is mounted on demand from somewhere that already
  // represents "open the chat" as its own action (e.g. clicking a chat
  // icon on /account) — skips relying on the #chat hash trick, which is
  // really meant for deep-linking in from a different page.
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [thinking, setThinking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(getSessionId(businessId));
  }, [businessId]);

  useEffect(() => {
    // Lets other pages (e.g. /account's "Message them" button) deep-link
    // straight into an open chat, and lets an on-page CTA in the hero do
    // the same thing without a full navigation — both just set the hash.
    const checkHash = () => {
      if (window.location.hash === '#chat') setOpen(true);
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    if (!open || !sessionId || loaded) return;
    fetch(`/api/web-chat?businessId=${businessId}&sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .finally(() => setLoaded(true));
  }, [open, sessionId, businessId, loaded]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  async function send() {
    const text = value.trim();
    if (!text || thinking || !sessionId) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setValue('');
    setThinking(true);

    const res = await fetch('/api/web-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, sessionId, message: text }),
    });
    const data = await res.json();
    setThinking(false);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: data.reply ?? 'Sorry, something went wrong. Please try again.' },
    ]);
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full flex items-center justify-center text-white shadow-[0_12px_28px_-8px_var(--accent)] transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'var(--accent)' }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16v12H8l-4 4V4z" />
            <path d="M8 9h8M8 12h5" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-[86px] right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[70vh] max-h-[520px] rounded-2xl bg-surface border-2 border-line shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden animate-rise">
          <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-2.5" style={{ background: 'var(--accent-soft)' }}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H8l-4 4V4z" /></svg>
            </div>
            <div>
              <div className="font-display text-[14.5px] font-semibold text-ink">Ask us anything</div>
              <div className="text-[11px] text-ink-faint">Check availability, book, or ask a question</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !thinking && (
              <div className="text-center text-[13px] text-ink-faint px-4 py-6">
                Try &ldquo;What&apos;s open tomorrow?&rdquo; or &ldquo;I&apos;d like to book a haircut&rdquo;
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' ? 'text-ink rounded-br-md' : 'text-white rounded-bl-md'
                  }`}
                  style={{ background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--accent)' }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="text-white rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] opacity-70" style={{ background: 'var(--accent)' }}>
                  {THINKING_LINES[0]}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-full bg-paper border border-line pl-4 pr-1.5 py-1.5 focus-within:border-[var(--accent)] transition-colors">
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                placeholder="Type a message…"
                className="flex-1 bg-transparent border-none outline-none text-[13.5px] text-ink placeholder-ink-faint"
              />
              <button
                onClick={send}
                disabled={!value.trim() || thinking}
                aria-label="Send"
                className="h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity disabled:opacity-30"
                style={{ background: 'var(--accent)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
