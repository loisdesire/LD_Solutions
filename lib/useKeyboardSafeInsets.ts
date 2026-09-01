'use client';

import { useEffect, useState } from 'react';

// "The keyboard pushed the screen up and I couldn't reach the exit" - a
// fixed-position mobile panel sized with plain top/bottom offsets doesn't
// actually know the keyboard opened; on many mobile browsers `fixed`
// sizes against the LAYOUT viewport, not the shrunk VISUAL one, so the
// panel keeps claiming space the keyboard is now covering and its own
// header/close button ends up pushed off past the top of the visible
// area. The VisualViewport API is the one reliable cross-browser way to
// know the actual visible height and offset while the keyboard is open.
//
// Returns null until it has a real reading (or on desktop/unsupported
// browsers, where nothing needs to change) - callers fall back to their
// normal CSS-only sizing in that case, this only overrides it once the
// keyboard genuinely changes the visible area.
export function useKeyboardSafeInsets(active: boolean): { top: number; height: number } | null {
  const [insets, setInsets] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) {
      setInsets(null);
      return;
    }
    const vv = window.visualViewport;

    function update() {
      // vv is non-null here - only called after the guard above, and TS
      // doesn't narrow a captured outer variable across the closure.
      setInsets({ top: vv!.offsetTop, height: vv!.height });
    }
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return insets;
}
