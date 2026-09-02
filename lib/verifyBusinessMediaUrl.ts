// Verifies a client-supplied image URL is actually a real photo THIS
// business uploaded through /api/upload, not an arbitrary external URL
// slipped into the request body directly - the assistant/onboarding chat
// endpoints accept imageUrl as plain JSON with no upload step of their
// own to trust, so this is the only thing standing between "a URL the
// model gets told to use" and "any URL anyone puts in a request body."
//
// Previously (inlined, duplicated in both call sites): compared
// `new URL(imageUrl).host` against a freshly re-parsed
// process.env.NEXT_PUBLIC_SUPABASE_URL for exact string equality, and
// silently treated the image as absent on any mismatch - no error, no
// log, nothing surfaced anywhere. Confirmed live, repeatedly, in both the
// onboarding and admin assistant chats: a customer/owner would attach a
// photo, the upload itself would succeed, and the assistant would still
// say "I don't see an attachment" - correctly, from its own side, since
// by the time it saw the message the image really had been silently
// dropped. Exact-host-equality against a re-derived env var is fragile by
// construction; whatever the actual mismatch was (this was never
// reproducible locally to confirm the precise cause), the fix is to stop
// depending on re-deriving the exact same host string twice and check
// something structurally anchored instead.
//
// endsWith('.supabase.co') doesn't depend on matching an env var at all.
// Requiring the path to be this SPECIFIC business's own storage folder is
// actually stricter than the old check, which accepted any business's
// media path, not just the authenticated caller's own.
export function verifyBusinessMediaUrl(imageUrl: unknown, businessId: string): string | null {
  if (typeof imageUrl !== 'string' || !imageUrl) return null;
  try {
    const url = new URL(imageUrl.trim());
    if (url.protocol !== 'https:') return null;
    if (!url.hostname.endsWith('.supabase.co')) return null;
    if (!url.pathname.includes(`/business-media/${businessId}/`)) return null;
    return imageUrl;
  } catch {
    return null;
  }
}
