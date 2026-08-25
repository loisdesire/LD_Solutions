'use client';

import { useEffect, useRef, useState } from 'react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// The reveal effect below is purely a rendering thing - `content` still
// ends up holding the real, full reply the moment it's done, and the
// server never sees any of this (history is reconstructed server-side
// from what's actually persisted, not from this client state), so there's
// no risk of a half-revealed string ever reaching the AI as if it were
// real conversation history.
const REVEAL_MS_PER_WORD = 35;
const REVEAL_MAX_MS = 1400;
const REVEAL_MIN_MS = 300;

const THINKING_LINES = ['Checking availability…', 'One moment…', 'Almost there…'];

// A random per-visitor id, one per business (a customer browsing two
// different businesses' pages should get two separate conversations, not
// one bleeding into the other) - persisted in localStorage so reopening
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
  businessName,
  serviceNames = [],
  defaultOpen = false,
}: {
  businessId: string;
  /** The chat speaks as the business, not as "an assistant". */
  businessName?: string;
  /** Openers are drawn from what this business actually sells. */
  serviceNames?: string[];
  // Set when this widget is mounted on demand from somewhere that already
  // represents "open the chat" as its own action (e.g. clicking a chat
  // icon on /account) - skips relying on the #chat hash trick, which is
  // really meant for deep-linking in from a different page.
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Real services beat a hardcoded example: "Do you do Braids?" only makes
  // sense if that business offers braids.
  const openers = [
    'What times are free tomorrow?',
    serviceNames[0] ? `How much is ${serviceNames[0]}?` : 'What do you charge?',
    'Are you open at the weekend?',
  ];
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [thinking, setThinking] = useState(false);
  // The whole reply used to appear as one instant block the moment the
  // request resolved - technically correct, but felt like a form
  // submitting, not a receptionist actually talking to you. This reveals
  // it word by word instead, purely client-side (the real text is already
  // in hand, this only controls how much of it is shown yet).
  const [revealing, setRevealing] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [thinkingLineIndex, setThinkingLineIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(getSessionId(businessId));
  }, [businessId]);

  useEffect(() => {
    // Lets other pages (e.g. /account's "Message them" button) deep-link
    // straight into an open chat, and lets an on-page CTA in the hero do
    // the same thing without a full navigation - both just set the hash.
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

  // Escape-to-close, and role="dialog" below - the panel had neither.
  // Deliberately not the full useDialog treatment (focus trap + body
  // scroll lock) other overlays in the app use: this is a floating
  // widget that coexists with the page, not a full-screen blocker - a
  // visitor should still be able to tab or scroll past it if they want
  // to, the way a real chat widget (Intercom, Drift) behaves. aria-label
  // alone is enough for a screen reader to announce what the region is.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  // Stray interval outliving the component (widget closed/unmounted
  // mid-reveal) would keep calling setState on nothing.
  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current);
    };
  }, []);

  // THINKING_LINES has 3 messages so a reply that takes a couple of
  // seconds doesn't just sit on the same static "Checking availability…"
  // the whole time - cycles while thinking is true, resets to the first
  // line at the start of every new request.
  useEffect(() => {
    if (!thinking) {
      setThinkingLineIndex(0);
      return;
    }
    const id = setInterval(() => {
      setThinkingLineIndex((i) => (i + 1) % THINKING_LINES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [thinking]);

  // Takes an optional message so a tapped opener can be sent directly,
  // rather than being typed into the box first.
  async function send(preset?: string) {
    const text = (preset ?? value).trim();
    if (!text || thinking || revealing || !sessionId) return;
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
    const fullReply: string = data.reply ?? 'Sorry, something went wrong. Please try again.';

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setMessages((prev) => [...prev, { role: 'assistant', content: fullReply }]);
      return;
    }

    setRevealing(true);
    const words = fullReply.split(' ');
    // Seeded with the first word already showing, not an empty bubble -
    // otherwise there's a blank flash between "thinking" disappearing and
    // the interval's first tick.
    setMessages((prev) => [...prev, { role: 'assistant', content: words[0] ?? '' }]);
    const totalMs = Math.min(REVEAL_MAX_MS, Math.max(REVEAL_MIN_MS, words.length * REVEAL_MS_PER_WORD));
    const perWord = totalMs / words.length;
    let shown = 1;
    if (shown >= words.length) {
      setRevealing(false);
      return;
    }
    revealTimer.current = setInterval(() => {
      shown += 1;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: words.slice(0, shown).join(' ') };
        return next;
      });
      if (shown >= words.length) {
        if (revealTimer.current) clearInterval(revealTimer.current);
        revealTimer.current = null;
        setRevealing(false);
      }
    }, perWord);
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen((v) => {
            // Closing clears the #chat hash. Without this, a second click on
            // a "Chat with us" link pointing at the same hash fires no
            // hashchange, so the chat never reopens: it works once, then
            // appears broken.
            if (v && window.location.hash === '#chat') {
              history.replaceState(null, '', window.location.pathname + window.location.search);
            }
            return !v;
          });
        }}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full flex items-center justify-center text-accent-contrast shadow-[0_12px_28px_-8px_var(--accent)] transition-transform hover:scale-105 active:scale-95"
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
        <div
          role="dialog"
          aria-label={`Chat with ${businessName ?? 'us'}`}
          className="fixed bottom-[86px] right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[70vh] max-h-[520px] rounded-2xl bg-surface border border-line shadow-card flex flex-col overflow-hidden animate-rise"
        >
          {/* Matches SelfBookingDemo's header exactly, on purpose - that's
              the "new chatbot" look: a solid accent avatar carrying the
              business's own initial (a brand mark, not a generic chat
              icon), the name up front, and a real status pill instead of
              a static "usually replies instantly" line - this widget is
              genuinely always on, so it says so plainly rather than
              hedging. */}
          <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-display text-[14px] font-bold text-accent-contrast" style={{ background: 'var(--accent)' }}>
              {businessName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink truncate">{businessName ?? 'Ask us anything'}</p>
              <p className="text-[10.5px] text-ink-faint">Chat on the booking page</p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Online
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !thinking && (
              // Tappable openers, drawn from this business's own services.
              // The old line hardcoded "haircut", which is wrong for a
              // clinic or a tutor, and asked people to compose a question
              // from nothing.
              <div className="px-1 py-4">
                <p className="text-[13px] text-ink-soft text-center mb-3.5">
                  Ask anything, or start here
                </p>
                <div className="flex flex-col gap-2">
                  {openers.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => send(o)}
                      className="text-left rounded-xl border border-line px-3.5 py-2.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent transition-colors"
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex animate-rise ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' ? 'text-ink rounded-br-md' : 'text-accent-contrast rounded-bl-md'
                  }`}
                  style={{ background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--accent)' }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start animate-rise">
                <div className="text-accent-contrast rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] opacity-70" style={{ background: 'var(--accent)' }}>
                  {THINKING_LINES[thinkingLineIndex]}
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
                aria-label="Type a message"
                placeholder="Type a message…"
                className="flex-1 bg-transparent border-none outline-none rounded-lg px-1 -mx-1 text-[13.5px] text-ink placeholder-ink-faint"
              />
              <button
                onClick={() => send()}
                disabled={!value.trim() || thinking || revealing}
                aria-label="Send"
                className="h-8 w-8 rounded-full flex items-center justify-center text-accent-contrast shrink-0 transition-all active:scale-90 disabled:opacity-30"
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
