// Structured error logging. This is NOT a substitute for real monitoring
// (Sentry, etc.) - nothing here alerts anyone or persists past the process
// lifetime. It exists so that (a) logs are consistently structured and
// greppable in whatever hosting platform's log viewer you're using, and
// (b) there's exactly one function to swap out for `Sentry.captureException`
// once there's an account to send it to.
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

export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
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
}
