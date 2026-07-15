'use client';

import { useState } from 'react';
import { SITE_URL } from '@/lib/site';
import CheckIcon from './CheckIcon';

const inputClass =
  'w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] font-mono text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

export default function BotIntegrationsSettings({
  slug,
  initialTelegramUsername,
  initialWhatsappNumber,
}: {
  slug: string;
  initialTelegramUsername: string | null;
  initialWhatsappNumber: string | null;
}) {
  return (
    <div className="space-y-8">
      <TelegramSection slug={slug} initialUsername={initialTelegramUsername} />
      <div className="border-t border-dashed border-line" />
      <WhatsappSection slug={slug} initialNumber={initialWhatsappNumber} />
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
    setSaving(true);
    setError('');
    const res = await fetch('/api/settings/telegram', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    setSaving(false);
    if (res.ok) setUsername(null);
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
        <div className="flex items-center justify-between gap-4 border border-line rounded-md px-4 py-3">
          <p className="text-[13.5px] text-ink-soft">
            Connected as <span className="font-mono text-ink">@{username}</span>
          </p>
          <button
            onClick={handleDisconnect}
            disabled={saving}
            className="text-[12.5px] font-medium text-ink-faint hover:text-red-600 transition-colors disabled:opacity-50"
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
              className="rounded-md bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function WhatsappSection({ slug, initialNumber }: { slug: string; initialNumber: string | null }) {
  const [number, setNumber] = useState(initialNumber);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${SITE_URL}/api/whatsapp/webhook`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/settings/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, whatsappNumber: input }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      return;
    }

    setNumber(input.trim());
    setInput('');
  }

  async function handleDisconnect() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/settings/whatsapp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    setSaving(false);
    if (res.ok) setNumber(null);
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 border border-line rounded-md px-4 py-3">
            <p className="font-mono text-[13.5px] text-ink">{number}</p>
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="text-[12.5px] font-medium text-ink-faint hover:text-red-600 transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
          <div>
            <p className="text-ink-faint text-[12px] mb-1.5">
              In your Twilio Console, set this number&apos;s &quot;When a message comes in&quot; webhook to:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-line-strong bg-paper px-3 py-2 text-[12px] font-mono text-ink-soft truncate">
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhookUrl}
                type="button"
                className="shrink-0 rounded-md border border-line-strong px-3 py-2 text-[12px] font-medium text-ink-soft hover:text-ink transition-colors"
              >
                {copied ? <CheckIcon className="h-3.5 w-3.5" /> : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-2.5">
          <p className="text-ink-faint text-[12px]">
            Requires your own Twilio WhatsApp-enabled number (not the shared sandbox). Enter it below, then
            paste the webhook URL we give you into that number&apos;s settings in your Twilio Console.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="whatsapp:+2348012345678"
              className={inputClass}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
