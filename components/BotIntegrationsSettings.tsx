'use client';

import { useEffect, useRef, useState } from 'react';

const inputClass =
  'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] font-mono text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

declare global {
  interface Window {
    FB?: { init: (opts: Record<string, unknown>) => void; login: (cb: (res: unknown) => void, opts: Record<string, unknown>) => void };
    fbAsyncInit?: () => void;
  }
}

export default function BotIntegrationsSettings({
  slug,
  initialTelegramUsername,
  initialWhatsappNumber,
  initialMessengerPageName,
}: {
  slug: string;
  initialTelegramUsername: string | null;
  initialWhatsappNumber: string | null;
  initialMessengerPageName: string | null;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-[16px] text-ink mb-1">Connected channels</h3>
        <p className="text-[12.5px] text-ink-faint">Connect the places where customers already message you.</p>
      </div>
      <TelegramSection slug={slug} initialUsername={initialTelegramUsername} />
      <div className="border-t border-dashed border-line" />
      <MessengerSection slug={slug} initialPageName={initialMessengerPageName} />
      <div className="border-t border-dashed border-line" />
      <WhatsappSection slug={slug} initialNumber={initialWhatsappNumber} />
    </div>
  );
}

function MessengerSection({ slug, initialPageName }: { slug: string; initialPageName: string | null }) {
  const [pageName, setPageName] = useState(initialPageName);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/settings/messenger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, pageAccessToken: token }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      return;
    }

    setPageName(data.pageName);
    setToken('');
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Facebook Messenger? Customers messaging your page will stop reaching the AI assistant until you reconnect.')) {
      return;
    }
    setSaving(true);
    setError('');
    // A failed DELETE used to do nothing at all — no error, badge still
    // reading "Connected", owner believing they'd disconnected when the
    // bot was in fact still live on their page.
    try {
      const res = await fetch('/api/settings/messenger', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setPageName(null);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't disconnect Messenger. It's still connected — please try again.");
      }
    } catch {
      setError("Couldn't reach the server. Messenger is still connected — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[14px] font-semibold text-ink">Facebook Messenger</p>
        {pageName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Connected
          </span>
        )}
      </div>

      {pageName ? (
        <div className="flex items-center justify-between gap-4 border-2 border-line rounded-xl px-4 py-3">
          <p className="text-[13.5px] text-ink-soft">
            Connected as <span className="font-mono text-ink">{pageName}</span>
          </p>
          <button
            onClick={handleDisconnect}
            disabled={saving}
            className="text-[12.5px] font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-2.5">
          <p className="text-ink-faint text-[12px]">
            In your Meta App dashboard, add the Messenger product, generate a Page Access Token for your
            Facebook Page, and paste it below.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAG..."
              className={inputClass}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-error mt-2">{error}</p>}
    </div>
  );
}

function TelegramSection({ slug, initialUsername }: { slug: string; initialUsername: string | null }) {
  const [username, setUsername] = useState(initialUsername);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/settings/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, botToken: token }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      return;
    }

    setUsername(data.botUsername);
    setToken('');
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect this Telegram bot? Customers messaging it will stop reaching the AI assistant until you reconnect.')) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings/telegram', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setUsername(null);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't disconnect the Telegram bot. It's still connected — please try again.");
      }
    } catch {
      setError("Couldn't reach the server. The bot is still connected — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[14px] font-semibold text-ink">Telegram bot</p>
        {username && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Connected
          </span>
        )}
      </div>

      {username ? (
        <div className="flex items-center justify-between gap-4 border-2 border-line rounded-xl px-4 py-3">
          <p className="text-[13.5px] text-ink-soft">
            Connected as <span className="font-mono text-ink">@{username}</span>
          </p>
          <button
            onClick={handleDisconnect}
            disabled={saving}
            className="text-[12.5px] font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-2.5">
          <p className="text-ink-faint text-[12px]">
            Message <span className="font-mono">@BotFather</span> on Telegram, send{' '}
            <span className="font-mono">/newbot</span>, and paste the token it gives you below.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:AAH..."
              className={inputClass}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-error mt-2">{error}</p>}
    </div>
  );
}

function WhatsappSection({ slug, initialNumber }: { slug: string; initialNumber: string | null }) {
  const [number, setNumber] = useState(initialNumber);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  // Meta posts a WA_EMBEDDED_SIGNUP message to the window as the owner
  // completes the popup — this is how we learn which WABA/number they
  // picked, since FB.login's own callback only ever hands back the auth code.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith('facebook.com')) return;
      let data: { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH' && data.data) {
        signupData.current = { wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id };
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (window.FB) {
      setSdkReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, xfbml: false, version: 'v21.0' });
      setSdkReady(true);
    };
    if (document.getElementById('facebook-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  async function finishConnect(code: string) {
    setSaving(true);
    const res = await fetch('/api/settings/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, code, ...signupData.current }),
    });
    const data = await res.json();
    setSaving(false);
    setConnecting(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      return;
    }
    setNumber(data.displayNumber);
  }

  function handleConnect() {
    if (!window.FB) return;
    setError('');
    signupData.current = {};
    setConnecting(true);

    // FB's SDK rejects an async function here (it type-checks the callback
    // itself), so this stays a plain function and hands off to a separate
    // async one instead of awaiting inline.
    window.FB.login(
      (response: unknown) => {
        const authResponse = (response as { authResponse?: { code?: string } })?.authResponse;
        const code = authResponse?.code;

        if (!code || !signupData.current.wabaId || !signupData.current.phoneNumberId) {
          setConnecting(false);
          return; // cancelled or closed without finishing — not an error to surface
        }

        finishConnect(code);
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      }
    );
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${number}? Customers messaging this number will stop reaching the AI assistant, and you'll need to redo Embedded Signup to reconnect it.`)) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setNumber(null);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't disconnect WhatsApp. It's still connected — please try again.");
      }
    } catch {
      setError("Couldn't reach the server. WhatsApp is still connected — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[14px] font-semibold text-ink">WhatsApp number</p>
        {number && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Connected
          </span>
        )}
      </div>

      {number ? (
        <div className="flex items-center justify-between gap-4 border-2 border-line rounded-xl px-4 py-3">
          <p className="font-mono text-[13.5px] text-ink">{number}</p>
          <button
            onClick={handleDisconnect}
            disabled={saving}
            className="text-[12.5px] font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-ink-faint text-[12px]">
            Connect the WhatsApp number you already message customers from. Heads up: linking it here
            deactivates the regular WhatsApp app on that number's phone — the bot takes over replying there.
          </p>
          <button
            onClick={handleConnect}
            disabled={!sdkReady || connecting}
            className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {connecting ? 'Connecting…' : 'Connect WhatsApp'}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-error mt-2">{error}</p>}
    </div>
  );
}
