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
    <div className="rounded-2xl border border-line bg-surface shadow-soft mb-8 overflow-hidden transition-colors focus-within:border-accent">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
        className="flex items-center gap-2.5 px-4 py-2.5"
      >
        <span
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: 'var(--accent)' }}
          aria-hidden="true"
        >
          <img src="/logo.png" alt="" className="h-[18px] w-[18px] object-contain" />
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Ask your assistant"
          placeholder="Ask about your bookings, or say what needs moving…"
          /* globals.css puts a 2px outline on every input's :focus-visible -
             correct, keyboard focus should never be *only* a colour change,
             but plain `outline-none` (specificity 0,1,0) actually LOSES to
             that bare `input:focus-visible` rule (0,1,1), so it kept
             drawing anyway - rounding its corners earlier only softened a
             box that was still there, it never actually suppressed it.
             `focus:outline-none` is the conditional form (0,2,0), which
             does win. The real replacement lives one level up: the whole
             card's border goes accent-coloured on focus-within, the same
             "the card itself lights up" treatment WebChatWidget's own
             input already uses, instead of a rectangle drawn tightly
             around just the input segment inside an otherwise seamless
             pill. truncate matters separately, for the placeholder on a
             narrow phone where icon + input + "Ask" share one line. */
          className="flex-1 min-w-0 truncate bg-transparent border-none outline-none focus:outline-none rounded-lg px-1 -mx-1 text-body-sm text-ink placeholder-ink-faint"
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
