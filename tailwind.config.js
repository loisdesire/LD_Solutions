/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        accent: 'var(--accent)',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        card: '0 0 0 1px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.03), 0 12px 40px rgba(0,0,0,0.06)',
        glow: '0 0 20px var(--accent-soft), 0 8px 32px -8px var(--accent-soft)',
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
      },
      animation: {
        rise: 'rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        punch: 'punch 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        popIn: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};
