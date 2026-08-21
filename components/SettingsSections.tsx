'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type SettingsSection = {
  key: string;
  label: string;
  description: string;
  content: ReactNode;
};

// Settings started as four stacked accordions, which cost roughly 350px of
// headers before any setting appeared. That became a nav column beside the
// content, which fixed the vertical waste but spent 224px of width on a
// list of four items.
//
// A dropdown costs neither: one control names the section you are in, and
// the settings themselves get the full width of the page.
export default function SettingsSections({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.key ?? '');
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const current = sections.find((s) => s.key === active) ?? sections[0];

  // Close on Escape or a click outside. Without both, a dropdown becomes
  // something you have to click exactly the right thing to dismiss.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (!current) return null;

  return (
    <div>
      <div ref={wrapRef} className="relative mb-6 max-w-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="listbox"
          className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-line-strong bg-surface px-4 py-3 min-h-[52px] text-left transition-colors hover:border-accent"
        >
          <span className="min-w-0">
            <span className="block text-body-sm font-semibold text-ink truncate">{current.label}</span>
            <span className="block text-caption text-ink-faint truncate">{current.description}</span>
          </span>
          {/* shrink-0 matters: without it the chevron compresses and slides
              past the rounded edge once the label runs long. */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <ul
            id={menuId}
            role="listbox"
            className="absolute z-30 left-0 right-0 mt-2 rounded-xl border-2 border-line bg-surface shadow-card overflow-hidden animate-rise"
          >
            {sections.map((s) => {
              const on = s.key === current.key;
              return (
                <li key={s.key} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(s.key);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 min-h-[52px] transition-colors ${
                      on ? 'bg-accent-soft' : 'hover:bg-warm-surface'
                    }`}
                  >
                    <span
                      className="block text-body-sm font-semibold"
                      style={{ color: on ? 'var(--accent)' : 'var(--ink)' }}
                    >
                      {s.label}
                    </span>
                    <span className="block text-caption text-ink-soft">{s.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="max-w-2xl">{current.content}</div>
    </div>
  );
}
