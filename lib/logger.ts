// Structured error logging, plus an opt-in email alert for the small set
// of failures where "nobody finds out until a customer complains" is a
// real cost, not just noise. Not a substitute for real monitoring
// (Sentry, etc.) - this is a floor, not a ceiling, and there's exactly
// one function (alertOnCritical below) to swap out for
// Sentry.captureException once there's an account to send it to. Not
// importing lib/email.ts's sendEmail deliberately - that file already
// imports logError for its own failure logging, and the thing that
// alerts you when something is broken should not itself depend on
// another feature that could be the thing that's broken. This does its
// own minimal, self-contained Resend call instead.
// Supabase's own PostgrestError type (which does extend Error, so
// .message/.stack were already captured) puts its actually useful
// diagnostic info in code/details/hint - its own doc comment says hint
// is usually THE most useful field ("logging only error.message hides
// the hint"), and none of the three were ever captured here. Every
// logError call site with a Postgrest error - and there are many, this
// codebase branches on error.code constantly - was silently losing the
// one piece of information most likely to say what actually went wrong.
// Duck-typed (`in`, not instanceof PostgrestError) so this also covers
// anything shaped the same way without importing the class just for this.
function pgFields(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) return {};
  const fields: Record<string, unknown> = {};
  for (const key of ['code', 'details', 'hint'] as const) {
    if (key in error) fields[key] = (error as Record<string, unknown>)[key];
  }
  return fields;
}

// Fires an email to ALERT_EMAIL for a genuinely critical failure -
// deliberately not every logError call (39 call sites at last count;
// alerting on all of them would drown the one that matters in routine,
// expected failures like a bad webhook signature from a scanning bot).
// Callers opt in explicitly with { critical: true }, reserved for
// failures where money moved and something about it is now wrong (a
// payment that wouldn't verify, a payout account that failed to link, a
// paid slot lost to a race) - see the call sites for the actual list.
//
// Rate-limited per CONTEXT (not globally) through the same atomic
// Postgres limiter every route already uses - the tenth "payment
// verification failed" in a minute from one flaky business's bad
// connection sends one email, not ten, but a genuinely new, different
// failure elsewhere still alerts immediately. No-ops silently if
// ALERT_EMAIL isn't set, same graceful-degradation pattern the rest of
// this app already follows for every optional integration - this is
// meant to be turned on by setting one env var, not a required setup
// step that breaks error logging if skipped.
//
// Never throws, never awaited by its caller (logError itself is
// synchronous) - an alert that failed to send must never be why the
// original error also failed to log or, worse, why the request handler
// that hit the original error itself blew up.
async function alertOnCritical(context: string, payload: Record<string, unknown>) {
  const to = process.env.ALERT_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) return;

  try {
    const { rateLimit } = await import('./rateLimit');
    const allowed = await rateLimit(`alert:${context}`, 1, 15 * 60_000);
    if (!allowed) return;

    const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `Vanova alert: ${context}`,
        html: `<pre style="font: 13px monospace; white-space: pre-wrap;">${JSON.stringify(payload, null, 2)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre>`,
      }),
    });
  } catch {
    // Swallowed on purpose - see the function comment above.
  }
}

export function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
  opts?: { critical?: boolean }
) {
  const payload = {
    level: 'error',
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...pgFields(error),
    time: new Date().toISOString(),
    ...extra,
  };
  console.error(JSON.stringify(payload));

  if (opts?.critical) void alertOnCritical(context, payload);
}
