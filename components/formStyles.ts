// Shared control styling - used directly by ~40 form controls across
// Services, Products, Staff, and everything built on Field.tsx.
//
// Two changes from the previous system, both deliberate:
// - Borders went from 2px to 1px (var(--line-strong) is already a
//   solid, visible tone - a 2px border read as a friendly hand-drawn
//   accent; 1px reads as a precise, considered tool, which is closer to
//   this pass's "clean, modern, premium" brief).
// - Labels dropped the tiny-mono-uppercase-tracked treatment that was
//   the single most repeated pattern across the whole app (every label,
//   on every form, everywhere) in favor of small, medium-weight regular
//   type - still clearly a label, but reads as interface copy rather
//   than a spec sheet, and doesn't compete with the tiny-uppercase
//   pattern that also carried "empty/inactive state" meaning elsewhere.
export const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

export const smallInputClass =
  'rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[13.5px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

export const labelClass = 'block text-[14px] font-medium text-ink-soft mb-1.5';

export const iconBtnClass =
  'h-8 w-8 flex items-center justify-center rounded-lg border border-line-strong text-ink-soft hover:border-accent hover:text-accent transition-colors';

export const pillClass = (active: boolean) =>
  `px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
    active ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink bg-warm-surface'
  }`;

// The small "● Connected" badge next to a channel/integration name -
// was the same literal class string retyped at 5 call sites
// (BotIntegrationsSettings.tsx's WhatsApp/Telegram/Messenger sections,
// PaymentsManager.tsx's Paystack section). Pair with connectedDotClass
// for the small filled circle inside it.
export const connectedBadgeClass =
  'inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent';
export const connectedDotClass = 'h-1.5 w-1.5 rounded-full bg-current';
