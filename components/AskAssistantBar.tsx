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
export default function AskAssistantBar({ slug }: { slug: string }) {
  const [value, setValue] = useState('');
  const router = useRouter();

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    router.push(`/${slug}/admin/assistant?q=${encodeURIComponent(q)}`);
  }

  return (
    // Previously a two-row form card: an icon+label row, then a separate
    // bordered input below it. Rebuilt as one seamless command-bar row -
    // the icon, the input, and the button all sit flush in the same
    // line, input has no border of its own since the card itself already
    // reads as the input's boundary. Matches the same solid-accent
    // icon-square brand mark SelfBookingDemo and WebChatWidget use, so
    // the assistant looks like the same thing everywhere it shows up.
    <div className="rounded-2xl border border-line bg-surface shadow-soft mb-8 overflow-hidden">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
        className="flex items-center gap-2.5 px-4 py-2.5"
      >
        <span
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-accent-contrast"
          style={{ background: 'var(--accent)' }}
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
          </svg>
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Ask your assistant"
          placeholder="Ask about your bookings, or say what needs moving…"
          /* globals.css puts a 2px outline on every input's :focus-visible so
             keyboard focus is never *only* a colour change - correct, but on
             a bare, unpadded, unrounded input it drew as a stray sharp-
             cornered rectangle floating mid-row. rounded-lg + a touch of
             padding (negative-margined back out so the input's own text
             doesn't shift against the icon/button either side of it) gives
             that same outline a shape to actually hug. */
          className="flex-1 min-w-0 bg-transparent border-none outline-none rounded-lg px-1 -mx-1 text-body-sm text-ink placeholder-ink-faint"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-lg px-3.5 py-2 min-h-[36px] text-caption font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-40 shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
