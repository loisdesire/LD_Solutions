'use client';

import { useState, type ReactNode } from 'react';

export type SettingsSection = {
  key: string;
  label: string;
  description: string;
  content: ReactNode;
};

// Settings began as four stacked accordions, then a nav column, then a
// dropdown on the page. All three spent space inside the page choosing
// which section to look at.
//
// Settings stays one sidebar destination. A compact in-page switcher keeps
// its related sections discoverable without turning five configuration
// details into five primary navigation destinations.
//
// Switching is client state now, not a <Link> to a new ?section= URL -
// every section's content is already fully fetched and passed in on the
// one initial page load (settings/page.tsx fetches everything up front),
// so there was never a real reason a tab click needed a fresh server
// round-trip. It used to be one, because `active` came straight from
// searchParams on a fully async Server Component - every single pill
// click re-ran that component's own auth check and two Supabase queries
// before the new tab's (already-available) content could show, which is
// exactly the "takes forever to load before it switches" being reported.
// The initial section still honors the URL - SetupChecklist links
// straight to ?section=profile/rules from elsewhere in the app - just via
// one read on mount rather than on every click.
export default function SettingsSections({
  sections,
  active,
}: {
  sections: SettingsSection[];
  active?: string;
}) {
  const [activeKey, setActiveKey] = useState(active ?? sections[0]?.key);
  const current = sections.find((s) => s.key === activeKey) ?? sections[0];
  if (!current) return null;

  return (
    <div>
      {/* Scrolls horizontally on mobile instead of wrapping to a second
          (and third) stacked row - five section pills wrapped at phone
          widths, pushing the actual heading and content down and reading
          like part of the page's structure rather than a single scannable
          switcher. -mx-4/px-4 lets the scroll area bleed to the true edge
          of the screen (so a partially-cut-off last pill hints there's
          more) while the pills themselves keep the page's normal margin. */}
      <nav aria-label="Settings sections" className="flex gap-2 mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {sections.map((section) => {
          const selected = section.key === current.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveKey(section.key)}
              aria-current={selected ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors ${
                selected ? 'bg-accent text-accent-contrast' : 'bg-surface border border-line text-ink-soft hover:text-ink hover:border-line-strong'
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </nav>
      {/* Now the page's one real heading (see settings/page.tsx) - eyebrow
          + h1 + subtitle, the same weight every other admin page under
          Automate/Business gives its own heading, not a smaller h2 living
          underneath a bigger generic one. */}
      <div className="mb-6">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">Business</div>
        <h1 className="font-display text-h1 text-ink">{current.label}</h1>
        <p className="text-ink-soft text-body-sm mt-1">{current.description}</p>
      </div>
      {/* One bordered card per section, matching how every other admin
          surface (dashboard cards, ManageBooking, BillingManager) contains
          its content - these five forms used to render bare, with nothing
          but internal dashed dividers to say where a section began or
          ended, which read as loose next to the rest of the app. */}
      <div className="max-w-2xl rounded-2xl border border-line bg-surface p-6 sm:p-7">{current.content}</div>
    </div>
  );
}
