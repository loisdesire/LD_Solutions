import { logError } from './logger';

// Resend's shared test sender — works without domain verification, but
// restricts delivery to the Resend account's own verified email until a
// real domain is verified. Swap for bookings@<yourdomain> once one exists.
const FROM_ADDRESS = 'onboarding@resend.dev';

// A rejected send (bad address, restricted recipient, rate limit) comes
// back from Resend as a normal non-2xx response, not a thrown exception —
// fetch() alone won't catch that, so this checks the response explicitly
// rather than only catching network-level errors. No-ops (returns false)
// when RESEND_API_KEY isn't configured, so callers can call this
// unconditionally rather than each gating on the env var themselves.
export async function sendEmail(
  { to, subject, html }: { to: string; subject: string; html: string },
  context: string,
  extra?: Record<string, unknown>
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
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
