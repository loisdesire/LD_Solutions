'use client';

import { useEffect, useRef, useState } from 'react';
import { useCloseOnBackButton } from '@/lib/useCloseOnBackButton';
import { useKeyboardSafeInsets } from '@/lib/useKeyboardSafeInsets';

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

// Generic on purpose - this widget answers anything about the business,
// not just booking questions, so a fixed "Checking availability…" showed
// up even when someone asked for the address or opening hours.
const THINKING_LINES = ['Thinking…', 'One moment…', 'Almost there…'];

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
  bookingId,
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
  // Passed from /account when this widget opens from a specific booking
  // the customer is logged in and already owns - lets the server (see
  // app/api/web-chat/route.ts's resolveIdentity) verify that ownership and
  // continue the REAL conversation this customer already has with the
  // business (e.g. one that started on Telegram), instead of a fresh
  // anonymous one. The server re-checks ownership itself; this is never
  // trusted on its own. Omit it anywhere else - a business's own public
  // page has no logged-in customer to verify against.
  bookingId?: string;
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
  // The autoComplete-token trick a few lines below wasn't enough on its
  // own - confirmed live, on a real phone: Chrome still showed its key/
  // card/location autofill icon strip above the keyboard AND a visible
  // highlighted border around the input itself (same root cause, not
  // two separate bugs - Chrome's autofill-candidate heuristics). Chrome
  // makes that "is this an autofill field" pass largely at page load /
  // first paint - starting the real input as readOnly means there's
  // nothing for that pass to flag yet, and switching it to editable the
  // instant it's actually focused (still on the very first tap, so it
  // doesn't cost anything real) happens after that pass already ran.
  const [inputEditable, setInputEditable] = useState(false);
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
  // Tracked reactively (not just read once) since rotating the phone or
  // resizing a browser window can cross the breakpoint while the chat is
  // still open.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // The phone's back button/gesture used to fall through to real browser
  // navigation - closing the chat had no handler for it at all, so it
  // took someone straight off the page they were trying to book on.
  useCloseOnBackButton(open, () => setOpen(false));

  // On mobile the panel is a full-viewport takeover (see className below);
  // `fixed inset-0` doesn't reliably resize when the keyboard opens on
  // every mobile browser, so the header/close button could end up pushed
  // out of the visible area with no way back to it. Only active on mobile
  // while open - desktop's small corner card never needs this.
  const keyboardInsets = useKeyboardSafeInsets(open && isMobile);

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
    const params = new URLSearchParams({ businessId, sessionId });
    if (bookingId) params.set('bookingId', bookingId);
    fetch(`/api/web-chat?${params}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .finally(() => setLoaded(true));
  }, [open, sessionId, businessId, loaded, bookingId]);

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

  // Below sm, the panel now takes over most of the screen (see the
  // className below) rather than sitting as a small corner card, so it
  // reads as a real screen, not a widget floating over one - lock
  // background scroll to match, same as any other mobile sheet. Left
  // alone above sm, where the panel still coexists with the page exactly
  // as the comment on the dialog below describes.
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

  // Stray interval outliving the component (widget closed/unmounted
  // mid-reveal) would keep calling setState on nothing.
  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current);
    };
  }, []);

  // THINKING_LINES has 3 messages so a reply that takes a couple of
  // seconds doesn't just sit on the same static "Thinking…" the whole
  // time - cycles while thinking is true, resets to the first line at the
  // start of every new request.
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
      body: JSON.stringify({ businessId, sessionId, bookingId, message: text }),
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

  // Extracted so the header's own back button (mobile, added below) fires
  // the exact same close - the old header X was removed specifically
  // because it "behaved slightly differently" (never cleared the #chat
  // hash), which the FAB alone didn't repeat, but re-adding a second
  // control the wrong way would.
  function toggleOpen() {
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
  }

  return (
    <>
      <button
        onClick={toggleOpen}
        aria-label={open ? 'Close chat' : 'Open chat'}
        // Hidden on mobile while open now, not "always visible, z-[60]" -
        // that earlier fix assumed this fixed-position button would stay
        // pinned to the true visible bottom edge, but bottom-5 is plain
        // CSS with no idea where the keyboard actually is; only the panel
        // itself (via useKeyboardSafeInsets) was ever made keyboard-aware.
        // Confirmed live: with the keyboard open, this either rendered off
        // past the real visible area or left a large dead gap reserved
        // for it above the keyboard - "the close button doesn't work"
        // again, the exact complaint this was first built to fix, just
        // from a different cause. The header's own back button (added
        // since, see the panel below) lives inside the panel's own
        // correctly-sized bounds and is the sole close control on mobile
        // now; this stays exactly as before on desktop, where there's no
        // keyboard-safe-area problem to begin with.
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16v12H8l-4 4V4z" />
            <path d="M8 9h8M8 12h5" />
          </svg>
        )}
      </button>

      {open && (
        // Below sm: true edge-to-edge takeover (inset-0, square corners)
        // rather than a card with margins - a margined card left gaps at
        // the top/bottom where the real page (header, page content) was
        // still visible behind it, which read as broken, not "blurred".
        // Fully opaque and covering the whole viewport, so there's
        // nothing left behind it to blur - no separate backdrop needed.
        // sm and up: unchanged, still the small corner card that
        // coexists with the page (see the comment below).
        <div
          role="dialog"
          aria-label={`Chat with ${businessName ?? 'us'}`}
          className="fixed inset-0 sm:inset-x-auto sm:inset-y-auto sm:top-auto sm:bottom-[86px] sm:right-5 sm:w-[calc(100vw-2.5rem)] sm:max-w-sm sm:h-[70vh] sm:max-h-[520px] z-50 rounded-none sm:rounded-2xl bg-surface border-0 sm:border border-line shadow-card flex flex-col overflow-hidden animate-rise"
          style={isMobile && keyboardInsets ? { top: keyboardInsets.top, height: keyboardInsets.height } : undefined}
        >
          {/* The "new chatbot" look: a solid accent avatar carrying the
              business's own initial (a brand mark, not a generic chat
              icon), the name up front, and a real status pill instead of
              a static "usually replies instantly" line - this widget is
              genuinely always on, so it says so plainly rather than
              hedging.

              A back-style button is here again on mobile only, at the
              top-left where a phone's own back control ordinarily sits -
              asked for directly. The floating FAB (bottom-right) had
              replaced this entirely because the ORIGINAL header X used to
              behave differently (never cleared the #chat hash) and could
              get pushed off-screen by the keyboard before
              useKeyboardSafeInsets existed to keep the panel's own bounds
              correct. Both are fixed now (this calls the exact same
              toggleOpen the FAB does; the panel's bounds already resize
              correctly for the keyboard), so it's safe to bring back
              without reintroducing either original problem. The FAB stays
              too, unchanged, for anyone who reaches for the same spot
              they tapped to open it. */}
          <div className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-3">
            <button
              onClick={toggleOpen}
              aria-label="Close chat"
              className="sm:hidden -ml-1.5 h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors shrink-0"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-display text-[14px] font-bold text-accent-contrast" style={{ background: 'var(--accent)' }}>
              {businessName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink truncate">{businessName ?? 'Ask us anything'}</p>
              <p className="text-[10.5px] text-ink-faint">Chat on the booking page</p>
            </div>
            <span
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Online
            </span>
          </div>

          {/* overscroll-contain - same fix as AssistantChat.tsx's identical
              message list: without it, scrolling to the top/bottom of this
              list hands the rest of the scroll to the business page
              underneath instead of just stopping. */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
            {messages.length === 0 && !thinking && (
              // Tappable openers, drawn from this business's own services.
              // The old line hardcoded "haircut", which is wrong for a
              // clinic or a tutor, and asked people to compose a question
              // from nothing.
              <div className="px-1 py-4">
                <p className="text-[14px] text-ink-soft text-center mb-3.5">
                  Ask anything, or start here
                </p>
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
                  // text-left set explicitly, not left to inherit - a
                  // message bubble should never depend on whatever
                  // text-align an ancestor happens to set (see the same
                  // fix, and the real bug it caused, in LandingChatDemo.tsx).
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap text-left ${
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

          {/* pb-20 dropped - it existed to reserve clearance for the
              floating FAB, which no longer floats over this panel while
              open on mobile (see the FAB's own comment above). Keeping
              that padding after removing the thing it was reserved for
              left a large dead gap sitting just above the input, worst
              exactly when the keyboard was open and every bit of vertical
              room actually mattered. Flat p-3 now, same as sm+.

              items-center, not items-end - this row has one single-line
              input, not a growing textarea, so there was never a reason
              to bottom-align it; it was leaving the placeholder text
              sitting visibly above center in the taller box below. */}
          <div className="shrink-0 border-t border-line p-3">
            <div className="flex items-center gap-2.5 rounded-2xl bg-paper border border-line pl-4 pr-2 py-2.5 focus-within:border-[var(--accent)] transition-colors">
              <input
                ref={inputRef}
                value={value}
                readOnly={!inputEditable}
                onChange={(e) => setValue(e.target.value)}
                onFocus={(e) => {
                  if (!inputEditable) {
                    setInputEditable(true);
                    // Removing readOnly can drop the text cursor on some
                    // browsers even though focus itself is kept - putting
                    // it back explicitly is cheap insurance against
                    // typing starting with no visible caret.
                    requestAnimationFrame(() => e.currentTarget.focus());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                aria-label="Type a message"
                placeholder="Type a message…"
                // A lone, auto-focused text input with no name/autocomplete
                // hint was getting swept into password-manager heuristics
                // on some mobile browsers - the "looks like it wants a
                // password" report. name + autoComplete="off" plus the
                // ignore hints the major password managers actually
                // respect (LastPass/1Password/Dashlane) rule this out.
                //
                // autoComplete is a made-up token now, not the literal
                // string "off" - Chrome has a well-documented history of
                // deliberately weakening/ignoring "off" specifically
                // (enough sites misused it to fight user preference that
                // Chrome stopped fully honoring it), which is almost
                // certainly why its own key/card/location autofill strip
                // still showed above this field despite autoComplete="off"
                // already being set. An unrecognized value gives Chrome no
                // known autofill category to match against at all, rather
                // than a hint it's specifically inclined to override.
                name="chat-message"
                autoComplete="chat-message-no-suggestions"
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
      )}
    </>
  );
}
