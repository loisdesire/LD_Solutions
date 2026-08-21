'use client';

import { useId, useState, type ReactNode } from 'react';

// The settings page grew to four full sections, each always fully expanded
// — that stacked height, not any single section's content, is what made it
// feel overwhelming. Collapsing to just the header by default lets someone
// see everything that's configurable at a glance, then open only the one
// thing they actually came to change. A colored icon per section (rotating
// through the platform's fixed accent/sage/blue trio — this is admin
// chrome, not a customer-branded page, so multi-color variety is fine
// here unlike the booking flow) makes the four sections scannable as
// distinct things instead of four identical gray rows.
export default function CollapsibleSection({
  title,
  description,
  icon,
  color,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="border-b border-line last:border-0">
      {/* Was a bare <button> — no aria-expanded, no aria-controls, so the
          only open/closed signal was a rotating chevron, which is invisible
          to a screen reader. AdminMobileNav already did this correctly. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group w-full flex items-center gap-4 py-5 text-left"
      >
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[16.5px] text-ink">{title}</h2>
          <p className="text-ink-soft text-[13px] mt-0.5">{description}</p>
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
      {open && (
        <div id={panelId} className="pb-8 pt-1 pl-0 sm:pl-[60px]">
          <div className="max-w-2xl">{children}</div>
        </div>
      )}
    </div>
  );
}
