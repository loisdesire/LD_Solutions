'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import Link from 'next/link';

type Message = { role: 'user' | 'assistant'; content: string };
type PendingImage = { url: string; previewUrl: string };

// The model naturally reaches for markdown when it summarizes a set of
// details (bold, "- " bullets, occasionally a [text](url) link) - this
// used to render as literal asterisks, hyphens and bracket/paren syntax
// since the bubble below was plain whitespace-pre-wrap text with no
// parsing at all. Deliberately small: just the handful of patterns the
// model actually produces, not a full markdown parser.
//
// A link only ever renders as a real, clickable <Link> when its href is
// a genuine relative in-app path (isSafeInternalPath below) - the exact
// shape assistantAgent.ts's system prompt now uses for "delete a
// service? that's on the real Services page" style replies (see its own
// allowlist of paths). Anything else - a full https:// URL, a
// protocol-relative //host, a stray storage link the model shouldn't be
// echoing back at all (see that same prompt's "never paste the raw URL"
// instruction) - falls back to showing the link TEXT ONLY, never the
// href, so a URL the model has been told not to expose still can't leak
// through this renderer even if it does anyway.
function formatAssistantContent(text: string): ReactNode {
  return text.split('\n').map((line, i) => {
    const bullet = line.match(/^(\s*)[-*]\s+(.*)/);
    return (
      <span key={i} className="block">
        {bullet ? <>• {formatInline(bullet[2])}</> : formatInline(line)}
      </span>
    );
  });
}

function isSafeInternalPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

function formatInline(text: string): ReactNode {
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      const href = match[3];
      parts.push(
        isSafeInternalPath(href) ? (
          <Link key={key++} href={href} className="font-medium underline underline-offset-2" style={{ color: 'var(--accent)' }}>
            {match[2]}
          </Link>
        ) : (
          <span key={key++} className="font-medium">{match[2]}</span>
        )
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

// Shared chat widget behind both dashboard AI assistants (Insights,
// Schedule assistant) - was two copies of the identical fetch/state/
// scroll-to-bottom/message-rendering logic, differing only in which
// endpoint they posted to and their copy. Each caller supplies its own
// endpoint, suggestions, and copy; this owns the mechanics.
// This one assistant does two different jobs in the same thread - answer a
// question, or change the schedule - by deliberate choice (it used to be
// two separate tabs; splitting it back out was tried and rejected, since
// almost nobody went looking for a feature they had to first decide which
// of two tools it lived under). Grouped suggestions is the compromise:
// still one chat, one input, one history, but the opening chips make the
// two kinds of thing it can do visually distinct from the first screen,
// instead of one flat row where "Move Ada to Monday" and "Who are my top
// customers?" read as the same kind of ask.
type SuggestionGroup = { label: string; items: string[] };

export default function AssistantChat({
  slug,
  endpoint,
  emptyStateText,
  suggestionGroups,
  inputPlaceholder,
  banner,
  initialMessage,
  initialMessages,
  onReplyData,
  bare = false,
}: {
  slug: string;
  endpoint: string;
  emptyStateText: string;
  suggestionGroups: SuggestionGroup[];
  inputPlaceholder: string;
  /** Asked automatically on mount, so a question typed elsewhere can open straight into its answer. */
  initialMessage?: string;
  /** Prior turns to restore on mount (fetched server-side by the page) - so navigating away mid-conversation and
   * coming back doesn't drop it. Seeds state once; this component owns the conversation from there. */
  initialMessages?: Message[];
  banner?: ReactNode;
  /** Called with the full parsed response body after every successful reply - additive to `reply`, for a caller
   * that needs more than the message text back (e.g. onboarding's live progress checklist, see OnboardingChat.tsx). */
  onReplyData?: (data: Record<string, unknown>) => void;
  /** Drops this component's own card chrome (border/rounding/background/fixed height) and fills its parent's
   * height instead - for a caller that already provides its own frame, like AdminAssistantWidget.tsx's floating
   * panel. Default false keeps the normal self-contained card used inline on a page (the Assistant/onboarding pages). */
  bare?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // The one thing this chat can attach - a photo for a service the AI's
  // about to create or update (see lib/manageTools.ts). Uploaded the
  // moment it's picked (same /api/upload endpoint ImageUploadField.tsx
  // already uses), not deferred to send time, so a broken upload shows up
  // as its own error right away rather than failing silently inside a
  // chat message later.
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleAttach(file: File) {
    setError('');
    setUploadingImage(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/upload?slug=${slug}`, { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Upload failed. Please try again.');
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setPendingImage({ url: data.url, previewUrl });
    } catch {
      setError("Upload failed - check your connection and try again.");
      URL.revokeObjectURL(previewUrl);
    } finally {
      setUploadingImage(false);
    }
  }

  // Was unconditional - fired on the very first render too, with zero
  // messages yet, since `messages` changing from nothing to `[]` still
  // counts as a change. bottomRef sits below the fold on an empty chat
  // (suggestion chips, empty-state copy), so the browser dutifully
  // scrolled the whole PAGE down to bring an empty div into view - not
  // just this card - which on a short mobile viewport was enough to
  // shove the page's own heading up behind the sticky header on load.
  // Confirmed live: no messages, no reason to autoscroll anything yet.
  useEffect(() => {
    if (messages.length === 0 && !loading) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Ask the opening question once. The ref guard matters because effects run
  // twice in development, and without it the question is sent twice.
  //
  // Was leaving ?q=... sitting in the address bar forever afterwards - not
  // just untidy (a full question, URL-encoded, permanently on display), but
  // a real behavior bug: refreshing this exact URL re-asked the same
  // question again, since `initialMessage` is read fresh from the URL on
  // every full page load and `askedRef` itself resets on reload. Clearing
  // the param via history.replaceState (no navigation event, no rerender,
  // just rewrites what's shown in the address bar) once the question has
  // actually been sent closes both.
  const askedRef = useRef(false);
  useEffect(() => {
    if (!initialMessage || askedRef.current) return;
    askedRef.current = true;
    send(initialMessage);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const imageUrl = pendingImage?.url ?? null;
    const sentImage = pendingImage;
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');

    // A dropped connection here used to leave the chat on "Thinking..."
    // permanently, with the input disabled and no error shown.
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, message: text, history: messages, imageUrl }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      // Only cleared on confirmed success - this used to clear
      // unconditionally BEFORE the request even resolved, so a failed
      // send (dropped connection, server error) silently dropped the
      // attached photo with no way to retry it: the message failed, but
      // the photo was already gone, and the error shown never mentioned
      // it. On success there's nothing left to hold onto; on failure the
      // photo (and its already-uploaded real URL - only the local blob
      // preview was ever at risk) stays attached so retrying the same
      // send actually retries the same photo.
      if (sentImage) URL.revokeObjectURL(sentImage.previewUrl);
      setPendingImage(null);
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }]);
      onReplyData?.(data);
    } catch {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div>
      {banner}

      {/* max-h-[70dvh], not 70vh - vh is pinned to the LAYOUT viewport and
          ignores the keyboard entirely, so on a phone this card kept
          claiming the same height after the keyboard opened, pushing its
          own input row (and the "Send" button) down past the now-shrunk
          visible area - reads as "the input keeps moving" as the browser
          repeatedly tries to scroll it back into view against a viewport
          that's already accounted for elsewhere. dvh tracks the real
          visible height as the keyboard opens/closes, no JS needed. */}
      <div className={bare ? 'flex flex-col h-full' : 'border-2 border-line rounded-2xl bg-surface flex flex-col h-[560px] max-h-[70dvh]'}>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
          {messages.length === 0 && (
            <div className="my-auto text-center">
              <p className="text-ink-soft text-[14px] mb-4">{emptyStateText}</p>
              <div className="flex flex-col items-center gap-3.5">
                {suggestionGroups.map((group) => (
                  <div key={group.label}>
                    <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-faint mb-2">
                      {group.label}
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {group.items.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-full border border-line px-3.5 py-2 text-[14px] text-ink-soft hover:border-line-strong hover:text-ink transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex animate-rise ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-accent text-accent-contrast' : 'bg-warm-surface text-ink'
                }`}
              >
                {m.role === 'assistant' ? formatAssistantContent(m.content) : m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-rise">
              <div className="bg-warm-surface rounded-2xl px-4 py-2.5 text-[14px] text-ink-faint">Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-error text-[13px] px-5 pb-1">{error}</p>}

        {/* A photo, once picked, sits here until it's actually sent - so
            it's obvious what "Create the haircut service with this photo"
            is about to attach, and there's a clear way to back out of it
            before it goes anywhere. */}
        {(pendingImage || uploadingImage) && (
          <div className="border-t border-line px-3 pt-3 flex items-center gap-2">
            <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-line-strong shrink-0 bg-warm-surface">
              {pendingImage && (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, next/image can't load those
                <img src={pendingImage.previewUrl} alt="Attached" className="h-full w-full object-cover" />
              )}
              {uploadingImage && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-[13px] text-ink-soft flex-1">
              {uploadingImage ? 'Uploading photo…' : 'Photo attached - it\'ll go with your next message.'}
            </p>
            {pendingImage && !uploadingImage && (
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pendingImage.previewUrl);
                  setPendingImage(null);
                }}
                aria-label="Remove attached photo"
                className="text-[13px] font-medium text-ink-faint hover:text-error transition-colors shrink-0"
              >
                Remove
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          // bare mode is exactly "embedded in AdminAssistantWidget's
          // floating panel" - its FAB now stays visible over the panel
          // even on mobile (see that component), so this reserves
          // clearance below the send button for it rather than the two
          // overlapping. The standalone full-page use (bare=false) has
          // no floating FAB to clear.
          className={`border-t border-line p-3 flex gap-2 ${bare ? 'pb-20 sm:pb-3' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleAttach(file);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            aria-label="Attach a photo"
            title="Attach a photo"
            className="rounded-xl border border-line px-3 text-ink-faint hover:border-accent hover:text-accent transition-colors disabled:opacity-50 shrink-0"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Belt and braces alongside the form's onSubmit below - some
              // mobile browsers don't reliably turn a soft keyboard's
              // return/go key into a real submit event. isComposing guards
              // against IME input, where Enter confirms a character rather
              // than sending the message.
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            enterKeyHint="send"
            aria-label="Ask your assistant"
            placeholder={inputPlaceholder}
            // Same fix as WebChatWidget's input - an unnamed text input
            // with no autocomplete hint was getting swept into
            // password-manager heuristics on some mobile browsers.
            name="assistant-message"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore=""
            data-form-type="other"
            className="flex-1 min-w-0 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading || uploadingImage || !input.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-accent-contrast transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
