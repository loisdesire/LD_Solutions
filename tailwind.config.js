/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        paper: '#F7F4EE',
        surface: '#FFFFFF',
        ink: '#1A1917',
        'ink-soft': '#55534A',
        'ink-faint': '#8B887C',
        line: '#E3DDD0',
        'line-strong': '#C7C0AC',
        accent: '#B5502F',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26,25,23,0.04), 0 4px 14px rgba(26,25,23,0.05)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        rise: 'rise 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};
