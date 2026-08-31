'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };
type PendingImage = { url: string; previewUrl: string };

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
  onReplyData,
}: {
  slug: string;
  endpoint: string;
  emptyStateText: string;
  suggestionGroups: SuggestionGroup[];
  inputPlaceholder: string;
  /** Asked automatically on mount, so a question typed elsewhere can open straight into its answer. */
  initialMessage?: string;
  banner?: ReactNode;
  /** Called with the full parsed response body after every successful reply - additive to `reply`, for a caller
   * that needs more than the message text back (e.g. onboarding's live progress checklist, see OnboardingChat.tsx). */
  onReplyData?: (data: Record<string, unknown>) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
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
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    // Cleared immediately, not after the request resolves - once it's on
    // its way to this specific message, holding it in the composer would
    // just mean the next message accidentally reattaches the same photo.
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
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

      <div className="border-2 border-line rounded-2xl bg-surface flex flex-col h-[560px] max-h-[70vh]">
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
                {m.content}
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
          className="border-t border-line p-3 flex gap-2"
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
            aria-label="Ask your assistant"
            placeholder={inputPlaceholder}
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
