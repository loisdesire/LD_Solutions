'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// The assistant is the reason this product exists, and it was the ninth
// item in a sidebar, on a page an owner had to decide to visit. Almost
// nobody goes looking for a feature they have not tried.
//
// This puts it where they already land every day. Typing here opens the
// assistant already answering, so the first experience of it is an answer
// rather than an empty chat box asking them to think of something.
export default function AskAssistantBar({
  slug,
  suggestions,
}: {
  slug: string;
  suggestions: string[];
}) {
  const [value, setValue] = useState('');
  const router = useRouter();

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    router.push(`/${slug}/admin/assistant?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 mb-8 shadow-soft">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-soft)' }}
          aria-hidden="true"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.9">
            <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
          </svg>
        </span>
        <p className="text-body-sm font-semibold text-ink">Ask your assistant</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Ask your assistant"
          placeholder="Ask about your bookings, or say what needs moving"
          className="flex-1 rounded-xl border-2 border-line-strong bg-paper px-4 py-3 min-h-[48px] text-body-sm outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-xl px-5 py-3 min-h-[48px] text-body-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          Ask
        </button>
      </form>

      {/* One tap is a much lower bar than composing a question, and it shows
          what the thing can actually do. */}
      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map((sug) => (
          <button
            key={sug}
            type="button"
            onClick={() => ask(sug)}
            className="rounded-full border border-line px-3 py-2 min-h-[36px] text-caption text-ink-soft hover:border-accent hover:text-accent transition-colors"
          >
            {sug}
          </button>
        ))}
      </div>
    </div>
  );
}
