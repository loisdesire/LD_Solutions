'use client';

import { useState } from 'react';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number | null;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string; products?: Product[] };

export default function ProductFinder({ businessId }: { businessId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: query }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          query,
          history: nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply ?? 'Sorry, something went wrong.', products: data.products },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line rounded-md overflow-hidden bg-surface">
      <div className="px-5 py-4 border-b border-line">
        <p className="font-display text-[18px] text-ink">Looking for something?</p>
        <p className="text-[13px] text-ink-soft mt-0.5">Describe what you want, I&apos;ll help you find it.</p>
      </div>

      <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-[13px] text-ink-faint">
            Try &quot;do you have anything for oily skin?&quot; or &quot;I need something red for a gift&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block rounded-md px-3.5 py-2.5 text-[13.5px] max-w-[85%] text-left ${
                m.role === 'user' ? 'bg-accent text-white' : 'bg-paper border border-line text-ink'
              }`}
            >
              {m.content}
            </div>
            {m.products && m.products.length > 0 && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {m.products.map((p) => (
                  <div key={p.id} className="border border-line rounded-md p-3 text-left">
                    <p className="font-semibold text-[13.5px] text-ink">{p.name}</p>
                    {p.description && <p className="text-[12px] text-ink-faint mt-0.5">{p.description}</p>}
                    <p className="font-mono text-[12.5px] text-ink mt-1.5">
                      {p.price != null ? `₦${p.price.toLocaleString()}` : ''}
                      {p.stock_quantity != null && (
                        <span className="text-ink-faint">
                          {' '}
                          · {p.stock_quantity > 0 ? `${p.stock_quantity} in stock` : 'Out of stock'}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <p className="text-[13px] text-ink-faint">Thinking…</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-line">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What are you looking for?"
          className="flex-1 rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
