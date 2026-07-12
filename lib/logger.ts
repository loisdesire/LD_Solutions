// Structured error logging. This is NOT a substitute for real monitoring
// (Sentry, etc.) — nothing here alerts anyone or persists past the process
// lifetime. It exists so that (a) logs are consistently structured and
// greppable in whatever hosting platform's log viewer you're using, and
// (b) there's exactly one function to swap out for `Sentry.captureException`
// once there's an account to send it to.
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const payload = {
    level: 'error',
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    time: new Date().toISOString(),
    ...extra,
  };
  console.error(JSON.stringify(payload));
}
