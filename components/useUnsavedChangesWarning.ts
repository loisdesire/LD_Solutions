'use client';

import { useEffect } from 'react';

// Settings forms track a local "saved" flag already, but nothing stopped
// someone from editing a field and then just navigating away or closing
// the tab - the change silently never happened, with no warning at all.
// `dirty` should be true exactly when the current field values have
// diverged from what's actually saved.
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome ignores the custom string and shows its own generic
      // message, but still requires `returnValue` to be set for the
      // prompt to appear at all.
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
