import type { CSSProperties, ReactNode } from 'react';
import { getContrastColor, hexToRgba } from '@/lib/color';

// Scopes --accent/--accent-contrast/--accent-soft to a business's own
// accent_color for everything inside it - and, since "every color on the
// page should match the selected accent" (a direct request, not a guess),
// also retints every neutral surface/border token to carry a real tint of
// that same color, so the whole shell reads as this business's color, not
// just the handful of elements that reference --accent directly.
//
// Each -base token below (see globals.css) is the true, never-overridden
// neutral value; color-mix blends the accent into it at a modest enough
// percentage that surfaces still read as "white card" / "warm page," not
// a stained-glass wash - deliberately NOT applied to text (--ink/-soft/
// -faint stay neutral; tinting body text would cost real contrast for a
// cosmetic win) or to the semantic status colors (--success/--warning/
// --error/--info stay meaning-first - "confirmed" should read as the same
// green regardless of whether this business's brand color is teal or
// terracotta). If that scope call is wrong, easy to extend - every token
// below follows the same one-line pattern.
//
// Used on any page wrapped in this component - customer-facing pages and,
// as of the admin shell change, every admin screen too.
export function AccentScope({
  color,
  children,
  className = '',
}: {
  color: string;
  children: ReactNode;
  className?: string;
}) {
  function tint(baseVar: string, percent: number): string {
    return `color-mix(in srgb, ${color} ${percent}%, var(${baseVar}))`;
  }
  const style = {
    '--accent': color,
    '--accent-contrast': getContrastColor(color),
    '--accent-soft': hexToRgba(color, 0.1),
    '--paper': tint('--paper-base', 5),
    // Confirmed live: at 4% into pure white, --surface (cards) already
    // read as barely-tinted, meaning the actual "pop" a card had against
    // the canvas behind it was coming almost entirely from the
    // --admin-canvas-base lightness gap, not from this tint - so pushing
    // this any lower doesn't cost the "every surface carries the accent"
    // intent much, and it matters more than it looks: for a cool accent
    // (blue, etc.) mixed against a WARM base, even a small percentage
    // measurably greys the result rather than tinting it cleanly (warm
    // and cool partially cancel each other's saturation) - cards are
    // where real content/text sits, so they're the one surface that most
    // needs to stay legible rather than take the brunt of that muddying.
    '--surface': tint('--surface-base', 2),
    '--warm-surface': tint('--warm-surface-base', 5),
    '--admin-canvas': tint('--admin-canvas-base', 4),
    '--line': tint('--line-base', 8),
    '--line-strong': tint('--line-strong-base', 12),
    '--ink-wash': tint('--ink-wash-base', 12),
  } as CSSProperties;
  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}
