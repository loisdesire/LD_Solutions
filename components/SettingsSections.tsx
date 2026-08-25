import type { ReactNode } from 'react';

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
// The choice belongs in the sidebar, under the Settings item, where every
// other destination already lives. This just renders whichever section the
// URL names, so the page itself is only settings. No client state, so it
// stays a server component.
export default function SettingsSections({
  sections,
  active,
}: {
  sections: SettingsSection[];
  active?: string;
}) {
  const current = sections.find((s) => s.key === active) ?? sections[0];
  if (!current) return null;

  return (
    <div>
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
