'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

// Shared chat widget behind both dashboard AI assistants (Insights,
// Schedule assistant) - was two copies of the identical fetch/state/
// scroll-to-bottom/message-rendering logic, differing only in which
// endpoint they posted to and their copy. Each caller supplies its own
// endpoint, suggestions, and copy; this owns the mechanics.
export default function AssistantChat({
  slug,
  endpoint,
  emptyStateText,
  suggestions,
  inputPlaceholder,
  banner,
  initialMessage,
}: {
  slug: string;
  endpoint: string;
  emptyStateText: string;
  suggestions: string[];
  inputPlaceholder: string;
  /** Asked automatically on mount, so a question typed elsewhere can open straight into its answer. */
  initialMessage?: string;
  banner?: ReactNode;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Ask the opening question once. The ref guard matters because effects run
  // twice in development, and without it the question is sent twice.
  const askedRef = useRef(false);
  useEffect(() => {
    if (!initialMessage || askedRef.current) return;
    askedRef.current = true;
    send(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
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
        body: JSON.stringify({ slug, message: text, history: messages }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }]);
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
              <p className="text-ink-soft text-[13.5px] mb-4">{emptyStateText}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:border-line-strong hover:text-ink transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-accent text-white' : 'bg-warm-surface text-ink'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-warm-surface rounded-2xl px-4 py-2.5 text-[13.5px] text-ink-faint">Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-error text-[12.5px] px-5 pb-1">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-line p-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={inputPlaceholder}
            className="flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
