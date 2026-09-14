'use client';

import { useEffect, useRef } from 'react';

// Any full-screen-feeling overlay (the chat widgets on mobile, and
// anything else that gets this treatment later) needs the phone's back
// button/gesture to close IT, not navigate the browser away from the
// page underneath - that's what "the bot has no way to exit and back
// takes me to the landing page" actually was: nothing here was listening
// for the back button at all, so it fell through to real browser
// navigation.
//
// The trick: push a history entry with the SAME url the instant the
// overlay opens. Since the url never changes, nothing about this ever
// triggers a real Next.js navigation - popstate firing is purely a
// signal, safe to treat as "close this." Pressing back pops that entry
// and fires popstate, which this treats as "close." Closing any other
// way (the X button, sending a message that auto-closes, whatever)
// pops the same entry itself via history.back() in cleanup, so a LATER
// real back-button press doesn't need an extra, confusing second press
// to actually leave the page.
export function useCloseOnBackButton(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Confirmed live, reported twice: attaching a photo opens the native
  // file/camera picker - an actual OS-level surface, not a web dialog -
  // and on some mobile browsers, control returning from it fires a
  // popstate on the page underneath as a side effect. Every popstate was
  // being treated as "the user pressed back, close this," so uploading a
  // photo could close the whole assistant instead of just attaching the
  // file. document.visibilityState reliably flips hidden->visible when
  // any native surface (file picker, camera, share sheet) opens over the
  // page and again when it returns - used as a general "we just came
  // back from somewhere else" signal, not something specific to file
  // pickers, so it also covers a camera capture or a share-sheet
  // interaction the same way.
  const returnedFromNativeSurfaceUntilRef = useRef(0);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        returnedFromNativeSurfaceUntilRef.current = Date.now() + 700;
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    window.history.pushState({ overlay: true }, '');
    pushedRef.current = true;

    function onPopState() {
      // Inside the grace window right after returning from a native
      // surface - treat this as that side effect, not a real back-button
      // press: put the entry straight back so a genuine back press right
      // after still closes the overlay normally.
      if (Date.now() < returnedFromNativeSurfaceUntilRef.current) {
        window.history.pushState({ overlay: true }, '');
        return;
      }
      pushedRef.current = false;
      onCloseRef.current();
    }
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      // Closed some other way while still sitting on the entry we
      // pushed (not via the back button itself, which already consumed
      // it) - pop it silently so history stays exactly as it would have
      // been if this overlay had never opened.
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);
}
