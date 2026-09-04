'use client';

import { useEffect, useRef, useState } from 'react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Same reveal/thinking mechanics as WebChatWidget.tsx (the same widget
// this actually calls into) - kept in sync deliberately rather than
// imported, since this component drops everything WebChatWidget carries
// for being a floating, open/closable overlay (the FAB, useKeyboardSafeInsets,
// the #chat hash, mobile full-viewport takeover) that a demo sitting
// inline in normal page flow, always visible, has no use for.
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

// The homepage's "Try live demo" used to send visitors straight off the
// page to a whole separate business - no embedded proof anywhere that
// the AI receptionist claim was real, just a link asking people to trust
// it first. This is the real thing: the exact same live Glow Salon
// widget (same /api/web-chat endpoint, same rate limiting, same
// businessId), just embedded inline instead of hidden behind a click and
// a floating panel. Deliberately NOT a new demo business or a scripted
// replay - Glow Salon's chat is already public and already live (that's
// what "Try live demo" already linked to), so this adds no new AI-cost
// or abuse surface, only visibility for one that already existed.
export default function LandingChatDemo({
  businessId,
  businessName,
  serviceNames = [],
}: {
  businessId: string;
  businessName: string;
  serviceNames?: string[];
}) {
  const openers = [
    'What times are free tomorrow?',
    serviceNames[0] ? `How much is ${serviceNames[0]}?` : 'What do you charge?',
    'Are you open at the weekend?',
  ];

  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [inputEditable, setInputEditable] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [thinkingLineIndex, setThinkingLineIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getSessionId(businessId));
  }, [businessId]);

  // Restores a real returning visitor's own thread (same session-id
  // mechanism WebChatWidget uses) rather than starting fresh every
  // reload - genuinely the same conversation if someone comes back to
  // try it again, or later visits Glow Salon's own page directly.
  useEffect(() => {
    if (!sessionId || loaded) return;
    fetch(`/api/web-chat?${new URLSearchParams({ businessId, sessionId })}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
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

  // Same fix as AssistantChat.tsx's standalone-card mode: this card sits
  // in normal page flow with real marketing content above it (the hero),
  // tall enough on a phone that the browser's own default "scroll the
  // focused input into view" can overshoot past the whole thing. Bringing
  // the card's own top edge to the top of the keyboard-shrunk viewport on
  // focus keeps the conversation and the input visible together.
  function handleInputFocus() {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 300);
  }

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
    const data = await res.json().catch(() => null);
    setThinking(false);
    const fullReply: string = data?.reply ?? 'Sorry, something went wrong. Please try again.';

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
      className="w-full max-w-md mx-auto rounded-3xl bg-surface border-2 border-line shadow-card flex flex-col h-[460px] overflow-hidden"
    >
      <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-display text-[14px] font-bold text-accent-contrast"
          style={{ background: 'var(--accent)' }}
        >
          {businessName[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink truncate">{businessName}</p>
          <p className="text-[10.5px] text-ink-faint">This is real - try it</p>
        </div>
        <span
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Online
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !thinking && (
          <div className="px-1 py-4">
            <p className="text-[14px] text-ink-soft text-center mb-3.5">Ask anything, or start here</p>
            <div className="flex flex-col gap-2">
              {openers.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => send(o)}
                  className="text-left rounded-xl border border-line px-3.5 py-2.5 text-[14px] text-ink-soft hover:border-accent hover:text-accent transition-colors"
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
      </div>

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
            name="landing-demo-message"
            autoComplete="landing-demo-message-no-suggestions"
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
