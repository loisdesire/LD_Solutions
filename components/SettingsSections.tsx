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
      <div className="mb-6">
        {/* Was the same 18px as the sub-section h3s each manager renders
            below it (BusinessProfileManager's "Identity", SiteContent's
            "Gallery", etc.) - the page's own section title needs to
            outrank those, not tie with them. */}
        <h2 className="font-display text-[21px] font-semibold text-ink">{current.label}</h2>
        <p className="text-ink-soft text-body-sm mt-1">{current.description}</p>
      </div>
      <div className="max-w-2xl">{current.content}</div>
    </div>
  );
}
