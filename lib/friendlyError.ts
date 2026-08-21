// Every auth form (login, signup, password reset) was showing
// `error.message` directly, with no fallback for the cases where that's
// empty, undefined, or the call throws instead of returning an error at
// all (e.g. a network blip, or an email provider silently rejecting a
// send) — those paths could put a raw, unreadable value like "{}" on
// screen, or leave the form stuck on "loading" forever with nothing
// shown. This is the one place every form's catch/error branch goes
// through, so there's exactly one spot to keep it readable everywhere.
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    const message = (err as { message: string }).message.trim();
    // A real Supabase/API error message reads as a sentence. "{}" (or
    // similar) means something upstream serialized an empty object
    // instead of a real error — confirmed live: Supabase's SMTP relay
    // failing produced exactly this, not a helpful string. Treat
    // anything that's just JSON-object-shaped punctuation as no message.
    if (message && !/^[{}[\]\s]*$/.test(message)) {
      return message;
    }
  }
  return fallback;
}
