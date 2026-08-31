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

export type NotificationStatus = 'checking' | 'unsupported' | 'ios-install-first' | 'off' | 'denied' | 'on' | 'busy';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// iPadOS 13+ deliberately reports as "MacIntel" in the user agent (Apple's
// own compatibility choice) - maxTouchPoints is what actually tells an
// iPad apart from a real Mac, which has none.
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Safari on iOS actually exposes the Push/Notification APIs even in a
// plain browser tab (so the earlier feature-detect below would otherwise
// call this "supported") - Notification.requestPermission() is the thing
// Apple restricts, silently going nowhere unless the site has actually
// been added to the home screen and opened from there. standalone is the
// iOS-specific signal for that; display-mode covers Android/desktop too.
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

// Extracted out of NotificationBell.tsx so a second surface (the
// dashboard's enable-notifications banner, see EnableNotificationsBanner.tsx)
// can read/act on the exact same permission state instead of running its
// own separate service-worker/subscription check that could disagree with
// the nav's own bell about whether notifications are actually on.
export function useNotificationStatus(slug: string) {
  const [status, setStatus] = useState<NotificationStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator)) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (isIOS() && !isStandalone()) {
        if (!cancelled) setStatus('ios-install-first');
        return;
      }
      if (!('PushManager' in window)) {
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

  return { status, enable, disable };
}

export const IOS_INSTALL_NOTE =
  'On iPhone/iPad: tap Share, then "Add to Home Screen" - notifications only work once this is opened from there, not from Safari itself';
