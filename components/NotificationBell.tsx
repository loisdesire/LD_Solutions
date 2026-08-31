'use client';

import { useNotificationStatus, IOS_INSTALL_NOTE } from './useNotificationStatus';

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

// Push notifications for new bookings - one subscription per device/browser,
// so this lives wherever a staff member can sign in from (desktop sidebar,
// compact rail, mobile menu), not a single global toggle. Renders nothing
// at all when push isn't set up on this deployment yet (no VAPID key) or
// isn't supported at all in this browser. On iOS specifically (Safari or
// any other iOS browser, since they all use WebKit under the hood) this
// shows an explanatory note instead of a working toggle when the site
// hasn't been added to the home screen yet - Apple only allows Web Push
// once it's opened from there, and silently going nowhere with no
// explanation is worse than telling someone the one extra step first.
//
// Permission-check/subscribe logic now lives in useNotificationStatus.ts,
// shared with EnableNotificationsBanner.tsx - this and the dashboard
// banner used to each run their own independent check, which could show
// two different answers for whether notifications were actually on.
export default function NotificationBell({ slug, variant }: { slug: string; variant: 'row' | 'rail' }) {
  const { status, enable, disable } = useNotificationStatus(slug);

  if (status === 'checking' || status === 'unsupported') return null;

  const label =
    status === 'on'
      ? 'Notifications on'
      : status === 'denied'
      ? 'Notifications blocked'
      : status === 'busy'
      ? 'Working…'
      : status === 'ios-install-first'
      ? 'Add to Home Screen to get notified'
      : 'Enable notifications';
  const disabledTitle =
    status === 'denied'
      ? 'Blocked in your browser settings - allow notifications for this site to turn it back on'
      : status === 'ios-install-first'
      ? IOS_INSTALL_NOTE
      : undefined;
  const clickHandler = status === 'on' ? disable : status === 'off' ? enable : undefined;
  const isDisabled = status === 'busy' || status === 'denied' || status === 'ios-install-first';

  if (variant === 'rail') {
    return (
      <button
        onClick={clickHandler}
        disabled={isDisabled}
        title={disabledTitle ?? label}
        aria-label={label}
        className="relative flex items-center justify-center h-11 w-11 rounded-xl transition-colors disabled:cursor-default"
        style={status === 'on' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
      >
        <span className={status === 'on' ? '' : 'text-ink-faint'}>
          <BellIcon filled={status === 'on'} />
        </span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={clickHandler}
        disabled={isDisabled}
        title={status === 'denied' ? disabledTitle : undefined}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body-sm text-ink-soft hover:bg-warm-surface hover:text-ink transition-colors disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className={status === 'on' ? 'shrink-0' : 'shrink-0 text-ink-faint'} style={status === 'on' ? { color: 'var(--accent)' } : undefined}>
          <BellIcon filled={status === 'on'} />
        </span>
        {label}
      </button>
      {/* Spelled out rather than left to a tooltip - a tooltip needs a
          hover a touch device never gets, and this is the one status that
          isn't self-explanatory (unlike "blocked", which the browser's own
          UI already told them about). */}
      {status === 'ios-install-first' && <p className="px-3 text-[11.5px] text-ink-faint leading-snug -mt-0.5">{IOS_INSTALL_NOTE}</p>}
    </div>
  );
}
