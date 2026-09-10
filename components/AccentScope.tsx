import type { CSSProperties, ReactNode } from 'react';
import { getContrastColor, hexToRgba, hexToHueSat } from '@/lib/color';

// The app's own base neutrals (globals.css) are a warm beige family,
// hand-tuned to sit under the platform's terracotta. Their hue is ~35deg.
const BASE_NEUTRAL_HUE = 35;

// How hard to push the neutral tint, by how far the business's accent
// sits from that warm base hue. A cool accent (blue, teal, green) mixed
// into a warm neutral partially cancels the warmth and reads as a clean,
// coordinated cool-grey - that's the case the tint was built for. A warm
// accent (terracotta, brown, gold) does the opposite: it stacks MORE
// warmth/saturation onto an already-warm neutral and the whole shell
// goes muddy - confirmed live, "the one with the default... looks quite
// painful to look at" next to a blue business's clean pages. So: near
// the base hue (or near-grey), tint barely at all - the base neutrals
// already coordinate with a warm accent on their own; far from it, tint
// in full as before.
function tintStrength(color: string): number {
  const { hue, sat } = hexToHueSat(color);
  if (sat < 0.12) return 0; // a near-grey accent has nothing to coordinate toward
  let dist = Math.abs(hue - BASE_NEUTRAL_HUE);
  if (dist > 180) dist = 360 - dist;
  // 0 within 22deg of the warm base, ramping to full by 90deg away.
  return Math.max(0, Math.min(1, (dist - 22) / 68));
}

// Scopes --accent/--accent-contrast/--accent-soft to a business's own
// accent_color for everything inside it - and, since "every color on the
// page should match the selected accent" (a direct request, not a guess),
// also retints every neutral surface/border token to carry a tint of that
// same colour, so the whole shell reads as this business's colour - but
// only as far as `tintStrength` above says it should for this particular
// hue (see that comment).
//
// Deliberately NOT applied to text (--ink/-soft/-faint stay neutral;
// tinting body text would cost real contrast for a cosmetic win) or to
// the semantic status colours (--success/--warning/--error/--info stay
// meaning-first).
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
  const strength = tintStrength(color);
  function tint(baseVar: string, percent: number): string {
    const p = percent * strength;
    // color-mix with 0% is valid but pointless - hand back the raw base
    // so a warm-accent business gets the exact hand-tuned neutral palette.
    return p < 0.5 ? `var(${baseVar})` : `color-mix(in srgb, ${color} ${p}%, var(${baseVar}))`;
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
