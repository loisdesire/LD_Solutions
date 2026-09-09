// Material Symbols Outlined - the admin shell's icon set as of the
// Stitch-generated dashboard redesign, replacing the hand-drawn inline
// SVGs AdminSidebar.tsx and friends used to carry one-by-one. `name` is
// the symbol's ligature name exactly as Google documents it (e.g.
// "dashboard", "calendar_today") - see
// https://fonts.google.com/icons?icon.set=Material+Symbols for the full
// set and to look up a name. The font itself is loaded once, in
// app/layout.tsx's <head>; .material-symbols-outlined (globals.css) is
// what actually turns the ligature text into a glyph.
export default function Icon({
  name,
  className = '',
  size,
  filled = false,
}: {
  name: string;
  className?: string;
  /** Pixel size - overrides the default 20px set in globals.css. */
  size?: number;
  /** Filled variant (FILL 1) - used sparingly, e.g. an active/selected state. */
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        ...(size ? { fontSize: size } : undefined),
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
