'use client';

import { useState, type ReactNode } from 'react';

// The settings page grew to four full sections, each always fully expanded
// — that stacked height, not any single section's content, is what made it
// feel overwhelming. Collapsing to just the header by default lets someone
// see everything that's configurable at a glance, then open only the one
// thing they actually came to change.
export default function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-6 text-left"
      >
        <div>
          <h2 className="font-display text-[17px] text-ink">{title}</h2>
          <p className="text-ink-soft text-[13px] mt-1.5">{description}</p>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="pb-7">{children}</div>}
    </div>
  );
}
