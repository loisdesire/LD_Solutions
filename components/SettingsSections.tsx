'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

export type SettingsSection = {
  key: string;
  label: string;
  description: string;
  content: ReactNode;
};

// Replaces a stack of accordions. Four collapsed sections cost roughly
// 350px of headers before any content appeared, each carrying a 40px
// decorative icon tile, and opening one pushed everything below it down
// the page. It read as busy because most of what was on screen was chrome
// rather than settings.
//
// One section at a time, chosen from a list beside it: the standard
// settings pattern, and it uses the horizontal space the old single
// column left empty. Nothing expands or collapses, so the page never
// reflows under you.
export default function SettingsSections({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.key ?? '');
  const current = sections.find((s) => s.key === active) ?? sections[0];

  return (
    <div className="md:flex md:gap-10 md:items-start">
      {/* Mobile: a scrollable row. Desktop: a sticky column. */}
      <nav
        aria-label="Settings sections"
        className="md:w-56 md:shrink-0 md:sticky md:top-6 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible -mx-5 px-5 md:mx-0 md:px-0 pb-3 md:pb-0 mb-5 md:mb-0"
      >
        {sections.map((s) => {
          const on = s.key === current?.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              aria-current={on ? 'page' : undefined}
              className={`shrink-0 md:shrink text-left rounded-xl px-3.5 py-2.5 min-h-[44px] text-body-sm font-medium whitespace-nowrap md:whitespace-normal transition-colors ${
                on ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-warm-surface hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-w-0">
        {current && (
          <>
            <div className="mb-5">
              <h2 className="font-display text-[18px] text-ink">{current.label}</h2>
              <p className="text-ink-soft text-body-sm mt-1">{current.description}</p>
            </div>
            <div className="max-w-2xl">{current.content}</div>
          </>
        )}
      </div>
    </div>
  );
}
