'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'market' | 'ledger';
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'market',
  setTheme: () => {},
});

export function useDesignPreviewTheme() {
  return useContext(ThemeContext);
}

// Market Day is the committed direction, so it's the default and the only
// one styled to full depth - Kept Ledger stays available as a quick visual
// reference (flip it with the button in the dev bar), not a second
// finished design. Persisted in localStorage only so it survives
// navigating between pages in this preview; has nothing to do with the
// real product's own theming.
export default function ThemeShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('market');

  useEffect(() => {
    const saved = localStorage.getItem('design-preview-theme');
    if (saved === 'ledger' || saved === 'market') setTheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('design-preview-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`dp-root theme-${theme}`}>{children}</div>
    </ThemeContext.Provider>
  );
}
