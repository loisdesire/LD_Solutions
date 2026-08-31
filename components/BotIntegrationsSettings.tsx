'use client';

import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

const inputClass =
  'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] font-mono text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

// "Connected" alone doesn't say whether a channel is actually being used -
// null just means no real customer message has come through it yet
// (including if the last-active migration hasn't run, since the page
// passes null in that case too), not that something's wrong.
function formatLastActive(iso: string | null): string {
  if (!iso) return 'No messages yet';
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Active just now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Active ${days}d ago`;
  return `Last active ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

// Both channels are fully built and testable in Meta's dev mode, but not
// cleared for a random business to turn on for real customers until App
// Review actually approves the app - still pending, no date. Flip this
// once it lands; nothing else about either section needs to change.
const WHATSAPP_MESSENGER_LIVE = false;

// The deactivated look the not-yet-connected state gets while
// WHATSAPP_MESSENGER_LIVE is false - explains itself via <details>
// (keyboard/touch/screen-reader accessible for free, no extra state) so
// this reads as "not yet, here's why" rather than a button that quietly
// does nothing or, worse, looks fully available and isn't.
function ComingSoonRow({ channel }: { channel: string }) {
  return (
    <details className="group border-2 border-dashed border-line rounded-xl px-4 py-3">
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none marker:content-none">
        <p className="text-body-sm text-ink-faint">Not available yet</p>
        <span className="text-caption font-semibold px-3 py-2 min-h-[40px] flex items-center rounded-lg text-ink-faint">
          Why? <span className="ml-1 transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <p className="text-caption text-ink-faint mt-2 leading-relaxed">
        {channel} needs Meta&rsquo;s App Review before it can go live for real customers - we&rsquo;ve submitted it
        and we&rsquo;re waiting on approval, not something you need to do on your end. We&rsquo;ll email you the
        moment it&rsquo;s ready to connect.
      </p>
    </details>
  );
}

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
  telegramLastActiveAt,
  whatsappLastActiveAt,
  messengerLastActiveAt,
}: {
  slug: string;
  initialTelegramUsername: string | null;
  initialWhatsappNumber: string | null;
  initialMessengerPageName: string | null;
  telegramLastActiveAt?: string | null;
  whatsappLastActiveAt?: string | null;
  messengerLastActiveAt?: string | null;
}) {
  return (
    <div className="space-y-8">
      {/* The page header already says what this is; a second heading
          underneath repeated it. */}

      {/* Website chat has no connect step - it is live on every public page
          the moment a business exists. Leaving it off this page made the
          list read as "you have nothing connected" when the most reliable
          channel was already running. Shaped exactly like the others, so it
          reads as one of the channels rather than a notice about them. */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[14px] font-semibold text-ink">Website chat</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            Always on
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-2 border-line rounded-xl px-4 py-3">
          <p className="text-body-sm text-ink-soft min-w-0">Live on your booking page. Nothing to set up.</p>
          {/* Was a permanently disabled "Set up" button that did nothing -
              the one channel this page can actually let you test right
              now, with zero setup required, had no way to do that.
              whitespace-nowrap + shrink-0: on a narrow phone the row had
              just enough space to squeeze "Try it" onto two lines instead
              of letting the sentence beside it wrap first - a two-word
              link split across two lines reads as broken, not urgent. */}
          <a
            href={`/${slug}#chat`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption font-semibold px-3 py-2 min-h-[40px] rounded-lg text-accent hover:bg-accent-soft transition-colors whitespace-nowrap shrink-0"
          >
            Try it
          </a>
        </div>
      </div>
      <WhatsappSection slug={slug} initialNumber={initialWhatsappNumber} lastActiveAt={whatsappLastActiveAt ?? null} />
      <div className="border-t border-dashed border-line" />
      <TelegramSection slug={slug} initialUsername={initialTelegramUsername} lastActiveAt={telegramLastActiveAt ?? null} />
      <div className="border-t border-dashed border-line" />
      <MessengerSection slug={slug} initialPageName={initialMessengerPageName} lastActiveAt={messengerLastActiveAt ?? null} />
    </div>
  );
}

// A channel that is not connected shows one line and a button, rather than
// unfurling its whole setup form. Three unconnected channels used to fill
// the page with instructions nobody had asked for yet, while the statuses
// this page exists to show got pushed off screen.
function NotConnectedRow({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-2 border-dashed border-line rounded-xl px-4 py-3">
      <p className="text-body-sm text-ink-faint">Not connected</p>
      <button
        type="button"
        onClick={onConnect}
        className="text-caption font-semibold px-3 py-2 min-h-[40px] rounded-lg transition-colors hover:bg-warm-surface"
        style={{ color: 'var(--accent)' }}
      >
        Set up
      </button>
    </div>
  );
}

function MessengerSection({
  slug,
  initialPageName,
  lastActiveAt,
}: {
  slug: string;
  initialPageName: string | null;
  lastActiveAt: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pageName, setPageName] = useState(initialPageName);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

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
      setError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }

    setPageName(data.pageName);
    setToken('');
  }

  async function handleDisconnect() {
    setConfirmingDisconnect(false);
    setSaving(true);
    setError('');
    // A failed DELETE used to do nothing at all - no error, badge still
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
        setError(data?.error ?? "Couldn't disconnect Messenger. It's still connected. Please try again.");
      }
    } catch {
      setError("Couldn't reach the server. Messenger is still connected. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[14px] font-semibold text-ink">Facebook Messenger</p>
        {pageName ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Connected
          </span>
        ) : !WHATSAPP_MESSENGER_LIVE ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-faint">
            Coming soon
          </span>
        ) : null}
      </div>
      <p className="text-caption text-ink-faint mb-2">
        Customers can ask about availability, get recommendations, and book directly in the chat.
      </p>

      {pageName ? (
        <div className="flex items-center justify-between gap-4 border-2 border-line rounded-xl px-4 py-3">
          <div>
            <p className="text-[13.5px] text-ink-soft">
              Connected as <span className="font-mono text-ink">{pageName}</span>
            </p>
            <p className="text-caption text-ink-faint mt-0.5">{formatLastActive(lastActiveAt)}</p>
          </div>
          <button
            onClick={() => setConfirmingDisconnect(true)}
            disabled={saving}
            className="text-[12.5px] font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : !WHATSAPP_MESSENGER_LIVE ? (
        <ComingSoonRow channel="Facebook Messenger" />
      ) : !expanded ? (
        <NotConnectedRow onConnect={() => setExpanded(true)} />
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
              aria-label="Facebook Page Access Token"
              placeholder="EAAG..."
              className={inputClass}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-error mt-2">{error}</p>}

      <ConfirmDialog
        open={confirmingDisconnect}
        title="Disconnect Facebook Messenger?"
        message="Customers messaging your page will stop reaching the AI assistant until you reconnect."
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting…"
        pending={saving}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}

function TelegramSection({
  slug,
  initialUsername,
  lastActiveAt,
}: {
  slug: string;
  initialUsername: string | null;
  lastActiveAt: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [username, setUsername] = useState(initialUsername);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

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
      setError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }

    setUsername(data.botUsername);
    setToken('');
  }

  async function handleDisconnect() {
    setConfirmingDisconnect(false);
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
        setError(data?.error ?? "Couldn't disconnect the Telegram bot. It's still connected. Please try again.");
      }
    } catch {
      setError("Couldn't reach the server. The bot is still connected. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[14px] font-semibold text-ink">Telegram</p>
        {username && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Connected
          </span>
        )}
      </div>
      <p className="text-caption text-ink-faint mb-2">
        Customers can ask about availability, get recommendations, and book directly in the chat.
      </p>

      {username ? (
        <div className="flex items-center justify-between gap-4 border-2 border-line rounded-xl px-4 py-3">
          <div>
            <p className="text-body-sm text-ink-soft">
              Connected as <span className="font-mono text-ink">@{username}</span>
            </p>
            <p className="text-caption text-ink-faint mt-0.5">{formatLastActive(lastActiveAt)}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* A real, working test action, not just a status line - opens
                a chat with the business's own bot on Telegram itself. */}
            <a
              href={`https://t.me/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] font-semibold text-accent hover:underline"
            >
              Test it
            </a>
            <button
              onClick={() => setConfirmingDisconnect(true)}
              disabled={saving}
              className="text-[12.5px] font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : !expanded ? (
        <NotConnectedRow onConnect={() => setExpanded(true)} />
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
              aria-label="Telegram bot token"
              placeholder="123456789:AAH..."
              className={inputClass}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-error mt-2">{error}</p>}

      <ConfirmDialog
        open={confirmingDisconnect}
        title="Disconnect this Telegram bot?"
        message="Customers messaging it will stop reaching the AI assistant until you reconnect."
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting…"
        pending={saving}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}

function WhatsappSection({
  slug,
  initialNumber,
  lastActiveAt,
}: {
  slug: string;
  initialNumber: string | null;
  lastActiveAt: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [number, setNumber] = useState(initialNumber);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  // Meta posts a WA_EMBEDDED_SIGNUP message to the window as the owner
  // completes the popup - this is how we learn which WABA/number they
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
      setError(data.error ?? 'Something went wrong. Please try again.');
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
          return; // cancelled or closed without finishing - not an error to surface
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
    setConfirmingDisconnect(false);
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
        setError(data?.error ?? "Couldn't disconnect WhatsApp. It's still connected. Please try again.");
      }
    } catch {
      setError("Couldn't reach the server. WhatsApp is still connected. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[14px] font-semibold text-ink">WhatsApp</p>
        {number ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Connected
          </span>
        ) : !WHATSAPP_MESSENGER_LIVE ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-faint">
            Coming soon
          </span>
        ) : null}
      </div>
      <p className="text-caption text-ink-faint mb-2">
        Customers can ask about availability, get recommendations, and book directly in the chat.
      </p>

      {number ? (
        <div className="flex items-center justify-between gap-4 border-2 border-line rounded-xl px-4 py-3">
          <div>
            <p className="text-body-sm text-ink-soft">
              Connected as <span className="font-mono text-ink">{number}</span>
            </p>
            <p className="text-caption text-ink-faint mt-0.5">{formatLastActive(lastActiveAt)}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* wa.me needs digits only - the display number can arrive
                formatted with a leading + and spaces. */}
            <a
              href={`https://wa.me/${number.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] font-semibold text-accent hover:underline"
            >
              Test it
            </a>
            <button
              onClick={() => setConfirmingDisconnect(true)}
              disabled={saving}
              className="text-[12.5px] font-medium text-ink-faint hover:text-error transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : !WHATSAPP_MESSENGER_LIVE ? (
        <ComingSoonRow channel="WhatsApp" />
      ) : !expanded ? (
        <NotConnectedRow onConnect={() => setExpanded(true)} />
      ) : (
        <div className="space-y-2.5">
          <p className="text-ink-faint text-[12px]">
            Connect the WhatsApp number you already message customers from. You&apos;ll sign in with Facebook and
            need a Meta Business account. If you don&apos;t have one yet, Meta walks you through creating it, which
            can take a day or two to be approved. Heads up: linking a number here deactivates the regular WhatsApp
            app on that phone. Your assistant takes over replying there.
          </p>
          <button
            onClick={handleConnect}
            disabled={!sdkReady || connecting}
            className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {connecting ? 'Connecting…' : 'Connect WhatsApp'}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-error mt-2">{error}</p>}

      <ConfirmDialog
        open={confirmingDisconnect}
        title="Disconnect WhatsApp?"
        message={`Disconnect ${number}? Customers messaging this number will stop reaching the AI assistant, and you'll need to redo Embedded Signup to reconnect it.`}
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting…"
        pending={saving}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}
