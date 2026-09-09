// Shared by every place a service name gets saved - the AI agent
// (lib/manageTools.ts) and the manual "Add service" form
// (components/ServicesManager.tsx) used to clean/capitalize this
// independently (the form didn't even trim), so a name typed lowercase in
// one path could look different from the same typo fixed in the other.
// One function, used both places, so "Sentence case, always" is one rule
// instead of two copies that can drift.
//
// Only the first character is touched, not a blanket lowercase-then-
// capitalize of the whole string - a name with deliberate internal
// capitals ("SPA Day") isn't clobbered just because it wasn't typed in
// pure sentence case to begin with.
export function toSentenceCase(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
