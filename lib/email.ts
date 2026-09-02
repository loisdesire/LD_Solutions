import { logError } from './logger';

// Set RESEND_FROM to a verified sender (e.g. bookings@vanovahub.com) once
// the domain is verified in Resend. Until then this falls back to Resend's
// shared test sender, which needs no verification but only ever delivers to
// the Resend account's own address - so real customers get nothing.
//
// Deliberately env-driven rather than hardcoded to the real domain:
// Resend rejects a From on an unverified domain outright, so hardcoding it
// ahead of verification would silently break EVERY email the product sends
// (booking confirmations, reminders, reschedule notices) with no code path
// left to fall back on.
const FROM_ADDRESS = process.env.RESEND_FROM || 'onboarding@resend.dev';

// Resend (like every real mail provider) only ever lets the ADDRESS
// portion be one verified, platform-owned domain - a business can't send
// as `hello@beadsbytilly.com` unless they've personally verified that
// domain with Resend, which isn't practical per-tenant. The DISPLAY NAME
// half of a From header has no such restriction though: "Beads by Tilly
// <bookings@vanovahub.com>" is completely valid and shows the business's
// own name in the recipient's inbox, not "Vanova" or whoever's account
// happens to own the sending domain. Strips any Name<email> wrapper
// FROM_ADDRESS might already have (depends how RESEND_FROM was set) down
// to the bare address, so a per-business display name always composes
// onto a clean address rather than accidentally nesting one Name<...>
// inside another.
const BARE_FROM_ADDRESS = FROM_ADDRESS.match(/<(.+)>/)?.[1] ?? FROM_ADDRESS;

// A rejected send (bad address, restricted recipient, rate limit) comes
// back from Resend as a normal non-2xx response, not a thrown exception -
// fetch() alone won't catch that, so this checks the response explicitly
// rather than only catching network-level errors. No-ops (returns false)
// when RESEND_API_KEY isn't configured, so callers can call this
// unconditionally rather than each gating on the env var themselves.
export async function sendEmail(
  { to, subject, html, fromName }: { to: string; subject: string; html: string; fromName?: string | null },
  context: string,
  extra?: Record<string, unknown>
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  const from = fromName ? `${fromName.replace(/[<>"]/g, '')} <${BARE_FROM_ADDRESS}>` : FROM_ADDRESS;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      logError(context, new Error(`Resend responded ${res.status}: ${await res.text()}`), extra);
      return false;
    }
    return true;
  } catch (err) {
    logError(context, err, extra);
    return false;
  }
}
