'use client';

import { useEffect, useRef } from 'react';

// Every overlay in this app - the new-appointment modal, the conversation
// drawer, the gallery lightbox, the chat panel, the mobile menus - was
// built without dialog semantics: no role, no focus trap, no Escape, and
// the page behind stayed scrollable. A keyboard user could tab straight
// out of an open modal into the page underneath and have no idea where
// they were.
//
// Returns a ref to spread onto the dialog container, alongside the
// role/aria attributes each caller applies.
//
// `onClose` deliberately does NOT sit in the effect's dependency array -
// it used to, and that was a real bug. Any modal whose form fields are
// lifted into the parent's state (AddServiceModal is the one that
// actually shipped this way) re-renders the parent on every keystroke,
// which creates a brand new `onClose={() => ...}` function reference each
// time. With `onClose` in the deps, that made this whole effect tear down
// and re-run on every single keystroke - re-stealing focus to the
// dialog's first focusable element mid-word. A ref holds the latest
// `onClose` without ever needing to re-run the effect for it; the setup
// (focus trap, Escape, scroll lock) now only runs once per open/close.
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog so the next Tab stays inside it.
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      // Wrap at both ends - without this, Tab walks out of the dialog.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind scrolling under the overlay.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      // Send focus back where it came from, so closing a dialog doesn't
      // dump the user at the top of the page.
      restoreTo.current?.focus?.();
    };
  }, [open]);

  return ref;
}
