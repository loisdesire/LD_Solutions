'use client';

import { useEffect, useRef, useState } from 'react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const REVEAL_MS_PER_WORD = 35;
const REVEAL_MAX_MS = 1400;
const REVEAL_MIN_MS = 300;
const THINKING_LINES = ['Thinking…', 'One moment…', 'Almost there…'];

function getSessionId(businessId: string): string {
  const key = `web-chat-session:${businessId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// The primary, first-seen interaction on a business's public page now,
// not a secondary "Not sure what to pick? Message us" link under a
// hero photo and a 3-step form - per the chat-first booking page spec.
// Real, live chat (same /api/web-chat endpoint, same session
// persistence, same underlying agent WebChatWidget.tsx's floating
// panel already uses elsewhere on this same page) - this is genuinely
// the same mechanism, just the primary entry point instead of a
// fallback. Suggested-prompt chips submit immediately on tap rather
// than just filling the input, so there's never a "now what" moment
// with an empty box staring back.
export default function ChatHero({
  businessId,
  businessName,
  suggestedPrompts,
  onBookingLinkFallback,
}: {
  businessId: string;
  businessName: string;
  suggestedPrompts: string[];
  /** Anchor to scroll to (the existing manual flow) when the chat backend errors - this is now the primary path, so a dead end here needs a real way out, not an infinite spinner. */
  onBookingLinkFallback: string;
}) {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [inputEditable, setInputEditable] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [thinkingLineIndex, setThinkingLineIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getSessionId(businessId));
  }, [businessId]);

  useEffect(() => {
    if (!sessionId || loaded) return;
    fetch(`/api/web-chat?${new URLSearchParams({ businessId, sessionId })}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [sessionId, businessId, loaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    if (!thinking) {
      setThinkingLineIndex(0);
      return;
    }
    const id = setInterval(() => setThinkingLineIndex((i) => (i + 1) % THINKING_LINES.length), 2200);
    return () => clearInterval(id);
  }, [thinking]);

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current);
    };
  }, []);

  // Same fix as the homepage demo and AssistantChat's standalone mode:
  // this card sits in normal page flow (the site nav sits above it),
  // tall enough on a phone that the browser's own default "scroll the
  // focused input into view" can overshoot past the whole conversation
  // - a confirmed regression, not a hypothetical, per the spec. Bringing
  // the card's own top edge to the top of the keyboard-shrunk viewport
  // on focus keeps the conversation and the input visible together.
  function handleInputFocus() {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 300);
  }

  async function send(preset?: string) {
    const text = (preset ?? value).trim();
    if (!text || thinking || revealing || !sessionId) return;
    setErrored(false);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setValue('');
    setThinking(true);

    let res: Response;
    try {
      res = await fetch('/api/web-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, message: text }),
      });
    } catch {
      setThinking(false);
      setErrored(true);
      return;
    }
    setThinking(false);
    if (!res.ok) {
      setErrored(true);
      return;
    }
    const data = await res.json().catch(() => null);
    const fullReply: string | undefined = data?.reply;
    if (!fullReply) {
      setErrored(true);
      return;
    }

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setMessages((prev) => [...prev, { role: 'assistant', content: fullReply }]);
      return;
    }

    setRevealing(true);
    const words = fullReply.split(' ');
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
    <div
      ref={cardRef}
      // The soft accent halo (shadow ring, not just a border) is what
      // makes this read as THE primary thing on the page the instant it
      // loads, matching the "can't miss it" role the spec calls for -
      // the info panel beside it is deliberately quieter.
      className="w-full rounded-2xl bg-surface border border-line flex flex-col h-[480px] overflow-hidden"
      style={{ boxShadow: '0 0 0 4px var(--accent-soft), 0 20px 40px -24px rgba(33,31,27,0.25)' }}
    >
      <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-3">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ background: '#4caf6d', boxShadow: '0 0 0 3px rgba(76,175,109,0.18)' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-ink truncate">Talk to {businessName}</p>
          <p className="text-[12px] text-ink-faint">Ask about a time, a price, anything</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !thinking && (
          <div className="rounded-2xl bg-warm-surface text-ink px-3.5 py-2.5 text-[14px] leading-relaxed max-w-[85%] animate-rise">
            Hi! I&rsquo;m {businessName}&rsquo;s assistant — ask me for a time, a price, or just tell me what you need.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex animate-rise ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap ${
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
            <div className="text-accent-contrast rounded-2xl rounded-bl-md px-3.5 py-2 text-[14px] opacity-80" style={{ background: 'var(--accent)' }}>
              {THINKING_LINES[thinkingLineIndex]}
            </div>
          </div>
        )}
        {errored && (
          // The one path that must degrade gracefully - this is the
          // primary path now, not a fallback, so a dead end here can't
          // just be an infinite typing indicator or a silent no-op.
          <div className="rounded-2xl bg-warm-surface text-ink-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[90%] animate-rise">
            Having trouble reaching {businessName}&rsquo;s assistant —{' '}
            <a href={onBookingLinkFallback} className="font-semibold underline underline-offset-2" style={{ color: 'var(--accent)' }}>
              try the full menu instead →
            </a>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="shrink-0 flex flex-wrap gap-2 px-4 pb-3">
          {suggestedPrompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              className="rounded-full border border-line bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink hover:border-accent hover:text-accent transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-2xl bg-paper border border-line pl-4 pr-2 py-2.5 focus-within:border-[var(--accent)] transition-colors">
          <input
            value={value}
            readOnly={!inputEditable}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => {
              if (!inputEditable) {
                setInputEditable(true);
                requestAnimationFrame(() => e.currentTarget.focus());
              }
              handleInputFocus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            aria-label="Type a message"
            placeholder="Type a message…"
            name="chat-hero-message"
            autoComplete="chat-hero-message-no-suggestions"
            data-lpignore="true"
            data-1p-ignore=""
            data-form-type="other"
            className="chat-composer-input flex-1 bg-transparent border-none outline-none focus:outline-none rounded-lg px-1 -mx-1 py-1 text-[14px] text-ink placeholder-ink-faint"
          />
          <button
            onClick={() => send()}
            disabled={!value.trim() || thinking || revealing}
            aria-label="Send"
            className="h-9 w-9 rounded-full flex items-center justify-center text-accent-contrast shrink-0 transition-all active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--accent)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
