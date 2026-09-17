import Link from 'next/link';
import type { ReactNode } from 'react';
import { SITE_URL } from './site';

// Shared between AssistantChat.tsx (admin) and WebChatWidget.tsx
// (customer) - was previously local to AssistantChat.tsx only, which
// meant the customer-facing widget rendered every message as flat,
// unformatted text with zero link handling at all. That's the surface a
// customer actually receives a Flutterwave payment link on (via
// lib/whatsappTools.ts's createBooking, which hands the model a bare
// https://checkout.flutterwave.com/... URL to paste into its own reply,
// not markdown - so a plain-text renderer left it inert, unclickable).
//
// Only two kinds of bare URL are ever auto-linked, both an explicit
// allowlist rather than "any https:// URL": Flutterwave's own checkout
// domain (the payment link itself) and this app's own domain (manage-
// booking links, the booking page). Anything else stays plain text -
// this is still model-generated content reaching an end customer, and an
// unrestricted auto-linker would make a prompt-injected or hallucinated
// URL just as clickable as a real one.
const TRUSTED_LINK_HOSTS = (() => {
  const hosts = new Set(['checkout.flutterwave.com']);
  try {
    hosts.add(new URL(SITE_URL).hostname);
  } catch {
    hosts.add('vanovahub.com');
  }
  return hosts;
})();

function isTrustedUrl(raw: string): boolean {
  try {
    return TRUSTED_LINK_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function isSafeInternalPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

const BARE_URL_PATTERN = /https?:\/\/[^\s)]+/g;

function formatInline(text: string): ReactNode {
  // First pass: **bold** and markdown-style [label](url) links (internal
  // paths only, same restriction as before). Second pass, applied to
  // whatever's left over as plain strings: bare trusted URLs, since the
  // model pastes the payment link as a raw URL in its own prose, never as
  // markdown link syntax.
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      const href = match[3];
      parts.push(
        isSafeInternalPath(href) ? (
          <Link key={key++} href={href} className="font-medium underline underline-offset-2" style={{ color: 'var(--accent)' }}>
            {match[2]}
          </Link>
        ) : (
          <span key={key++} className="font-medium">{match[2]}</span>
        )
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts.flatMap((part, i) => {
    if (typeof part !== 'string') return [part];
    const urlParts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    BARE_URL_PATTERN.lastIndex = 0;
    while ((m = BARE_URL_PATTERN.exec(part))) {
      // Trim trailing sentence punctuation the model's own prose would
      // naturally put right after a pasted URL ("...pay here: <url>.") -
      // otherwise it becomes part of the href, breaking the link.
      const rawUrl = m[0];
      const trimMatch = rawUrl.match(/^(.*?)([.,;:!?)\]}'"]+)?$/);
      const url = trimMatch?.[1] ?? rawUrl;
      const end = m.index + url.length;
      if (!url || !isTrustedUrl(url)) continue;
      if (m.index > last) urlParts.push(part.slice(last, m.index));
      urlParts.push(
        <a
          key={`u${i}-${k++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 break-all"
          style={{ color: 'var(--accent)' }}
        >
          {url}
        </a>
      );
      last = end;
    }
    if (last === 0) return [part];
    if (last < part.length) urlParts.push(part.slice(last));
    return urlParts;
  });
}

export function formatChatText(text: string): ReactNode {
  return text.split('\n').map((line, i) => {
    const bullet = line.match(/^(\s*)[-*]\s+(.*)/);
    return (
      <span key={i} className="block">
        {bullet ? <>• {formatInline(bullet[2])}</> : formatInline(line)}
      </span>
    );
  });
}
