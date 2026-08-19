// Shared local-time formatting for AI agent tool results — pure, no I/O.
// Was three near-identical copies (whatsappTools.ts, rescheduleTools.ts,
// and an inline duplicate in insightsTools.ts) quietly able to drift from
// each other; now one definition every agent's tools format times with.
//
// The model repeatedly doing UTC→local mental math across a long
// conversation is exactly the kind of arithmetic LLMs get wrong silently —
// formatting server-side, deterministically, removes that error class
// entirely: the model only ever sees an already-correct string.
export function formatLocalDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatLocalTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

export function to24Hour(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
}
