/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        ink: '#0B0B14',
        canvas: '#FAFAFC',
        muted: '#6B7280',
        line: '#E7E7EF',
        accent: '#5B4CF0',
        accent2: '#B347EA',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #5B4CF0 0%, #B347EA 100%)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,11,20,0.04), 0 8px 24px rgba(11,11,20,0.06)',
        glow: '0 8px 30px rgba(91,76,240,0.25)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        rise: 'rise 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
