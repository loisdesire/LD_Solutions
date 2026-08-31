'use client';

import { useEffect, useState } from 'react';

// A browser's push subscription key needs to be a Uint8Array, but the
// public key we hand out is a URL-safe base64 string - this is the
// standard conversion (there's no built-in for it).
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = 'checking' | 'unsupported' | 'off' | 'denied' | 'on' | 'busy';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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
// isn't supported in this browser (notably: iOS Safari only supports Web
// Push once the dashboard has actually been added to the home screen and
// opened from there, not from a regular browser tab).
export default function NotificationBell({ slug, variant }: { slug: string; variant: 'row' | 'rail' }) {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? 'on' : 'off');
      } catch {
        if (!cancelled) setStatus('off');
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setStatus('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        setStatus('off');
        return;
      }
      setStatus('on');
    } catch {
      setStatus('off');
    }
  }

  async function disable() {
    setStatus('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } finally {
      setStatus('off');
    }
  }

  if (status === 'checking' || status === 'unsupported') return null;

  const label = status === 'on' ? 'Notifications on' : status === 'denied' ? 'Notifications blocked' : status === 'busy' ? 'Working…' : 'Enable notifications';

  if (variant === 'rail') {
    return (
      <button
        onClick={status === 'on' ? disable : status === 'off' ? enable : undefined}
        disabled={status === 'busy' || status === 'denied'}
        title={status === 'denied' ? 'Blocked in your browser settings - allow notifications for this site to turn it back on' : label}
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
    <button
      onClick={status === 'on' ? disable : status === 'off' ? enable : undefined}
      disabled={status === 'busy' || status === 'denied'}
      title={status === 'denied' ? 'Blocked in your browser settings - allow notifications for this site to turn it back on' : undefined}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body-sm text-ink-soft hover:bg-warm-surface hover:text-ink transition-colors disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className={status === 'on' ? 'shrink-0' : 'shrink-0 text-ink-faint'} style={status === 'on' ? { color: 'var(--accent)' } : undefined}>
        <BellIcon filled={status === 'on'} />
      </span>
      {label}
    </button>
  );
}
