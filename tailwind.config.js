/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        // --font-mono no longer exists: the product dropped monospace. Kept
        // as an alias of the body face so the ~173 existing `font-mono`
        // usages keep working and mean "small label", not "monospaced".
        mono: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      // Named steps for the sizes already in near-universal use across the
      // app as one-off arbitrary values (text-[13.5px], text-[11px], etc.)
      // — every step here matches an existing value exactly, so adopting
      // these in a component is a rename, not a visual change. Existing
      // text-[Npx] usages elsewhere keep working untouched; this is additive.
      fontSize: {
        label: '12px',
        caption: '13px',
        'body-sm': '14px',
        body: '14.5px',
        lead: '16px',
        h3: '19px',
        h2: '22px',
        h1: '26px',
        display: '32px',
      },
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'warm-surface': 'var(--warm-surface)',
        'cream-surface': 'var(--cream-surface)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        'ink-wash': 'var(--ink-wash)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-active': 'var(--accent-active)',
        // These were only ever consumed via inline `style={{...}}` /
        // arbitrary-value classes elsewhere, but `accent-soft` was used as
        // a plain Tailwind class (`bg-accent-soft`, `text-accent-soft`) in
        // several components — since Tailwind v3 only generates utilities
        // for colors registered here, every one of those was silently
        // producing no CSS at all. Registering all of them so the same
        // mistake can't recur.
        'accent-soft': 'var(--accent-soft)',
        'accent-contrast': 'var(--accent-contrast)',
        cream: 'var(--cream)',
        'cream-hover': 'var(--cream-hover)',
        'cream-contrast': 'var(--cream-contrast)',
        tertiary: 'var(--tertiary)',
        'secondary-dark': 'var(--secondary-dark)',
        // Semantic — independent of brand color on purpose. "Confirmed"
        // should read as success-green whether a business's own accent is
        // teal, terracotta, or anything else they've picked.
        success: 'var(--success)',
        'success-bg': 'var(--success-bg)',
        'success-border': 'var(--success-border)',
        warning: 'var(--warning)',
        'warning-bg': 'var(--warning-bg)',
        'warning-border': 'var(--warning-border)',
        error: 'var(--error)',
        'error-bg': 'var(--error-bg)',
        'error-border': 'var(--error-border)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        'info-border': 'var(--info-border)',
      },
      // Tighter than Tailwind's defaults (xl: 12px→10px, 2xl: 16px→14px,
      // 3xl: 24px→20px) - the previous system reached for 2xl/3xl on
      // nearly everything, which read as soft/editorial rather than
      // precise. Cascades everywhere `rounded-2xl` etc. is already used,
      // no per-file changes needed. `full` is untouched - pills/avatars
      // only, used more sparingly now rather than as the default badge
      // treatment.
      borderRadius: {
        lg: '8px',
        xl: '10px',
        '2xl': '14px',
        '3xl': '20px',
      },
      boxShadow: {
        // Slightly cooler-toned and crisper than a pure-black shadow -
        // cards read as lifted surfaces (elevation), not just boxes with
        // borders, which is a real part of what makes this feel more
        // premium/contemporary than the previous flat-bordered system.
        soft: '0 1px 2px rgba(15,17,25,0.04), 0 2px 8px rgba(15,17,25,0.05)',
        card: '0 0 0 1px rgba(15,17,25,0.04), 0 1px 2px rgba(15,17,25,0.04), 0 16px 40px -12px rgba(15,17,25,0.12)',
        glow: '0 0 24px var(--accent-soft), 0 8px 32px -8px var(--accent-soft)',
        // New: a subtler, tighter lift for interactive rows/small cards
        // that shouldn't compete with a page's primary card.
        lift: '0 1px 2px rgba(15,17,25,0.06)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // Quick compress-and-release on the pill a customer just selected —
        // the "ticket punch" that makes picking a time feel like the act it
        // represents, not a checkbox toggle.
        punch: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        // A little overshoot-and-settle for the confirmation screen's
        // success icon — makes the moment feel like a genuine payoff,
        // not just another state change.
        popIn: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        // Modal backdrop — a plain opacity fade, no movement, so it reads
        // as the page dimming behind the modal rather than another
        // element arriving on stage.
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        punch: 'punch 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        popIn: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        fade: 'fade 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
