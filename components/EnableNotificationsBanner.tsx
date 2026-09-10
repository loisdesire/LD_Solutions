'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useNotificationStatus, IOS_INSTALL_NOTE } from './useNotificationStatus';

// The "enable notifications" ask was easy to miss, sitting in the nav
// (sidebar/rail/mobile menu) - discoverable only if you go looking for
// it, on a feature most owners would actually want. This surfaces the
// same ask on the dashboard itself, the one screen everyone lands on,
// dismissible so it doesn't nag forever once seen. Renders nothing once
// notifications are already on, already blocked (the browser's own UI
// already told them that story), unsupported, or dismissed.
export default function EnableNotificationsBanner({ slug }: { slug: string }) {
  const { status, enable } = useNotificationStatus(slug);
  const [dismissed, setDismissed] = useState(true); // starts hidden - see the effect below

  // Dismissal is per-business (a different slug should ask again) and
  // read only after mount, same reasoning as elsewhere in this app that
  // touches localStorage - keeps the server-rendered markup and the
  // first client render matching exactly.
  const storageKey = `notif-banner-dismissed:${slug}`;
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Private browsing / storage disabled - the banner just reappears
      // next visit, which is a fine fallback rather than something to
      // surface an error over.
    }
  }

  if (dismissed || (status !== 'off' && status !== 'ios-install-first')) return null;

  return (
    // rounded-xl, matching every other card on this page now.
    <div className="rounded-xl border border-line bg-warm-surface px-5 py-4 mb-6 flex items-center gap-4 flex-wrap sm:flex-nowrap">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        <Icon name="notifications" size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-ink">Know the moment someone books</p>
        <p className="text-caption text-ink-faint mt-0.5">
          {status === 'ios-install-first'
            ? IOS_INSTALL_NOTE
            : 'Turn on notifications and a new booking reaches you without needing this tab open.'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {status === 'off' && (
          <button
            onClick={enable}
            className="rounded-full bg-accent px-4 py-2 min-h-[36px] text-caption font-semibold text-accent-contrast transition-opacity hover:opacity-90"
          >
            Enable notifications
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="h-8 w-8 flex items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink transition-colors shrink-0"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
