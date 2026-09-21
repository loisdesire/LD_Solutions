// Shared between the full /admin/assistant page and the floating
// AdminAssistantWidget (every other admin page) - one list, so the
// starter prompts someone sees don't depend on which of the two they
// happened to open.
//
// One flat list, not grouped under headers - the owner's own call:
// splitting "ask a question" from "change something" from "manage your
// business" added visual structure nobody asked for and made the popover
// feel like three separate menus instead of one list of ideas. A flat
// list left-aligned is just easier to scan.
//
// Deliberately not exhaustive - the point is showing a few genuinely
// surprising capabilities (a theme color change, hiding a service,
// turning off a whole page) alongside the obvious ones (reschedule, add
// a service), so someone staring at a blank chat box comes away thinking
// "oh, it can do that too" rather than just "it takes bookings." See
// lib/manageTools.ts for the full real tool list every one of these
// actually maps to - nothing here is aspirational copy.
//
// Kept short on purpose - the owner's own call: each one should read as
// a single line, not wrap, inside a ~280px chip. Trimmed the specific
// examples (a price, a duration, a color) that pushed several of these
// onto two lines - the idea still comes through without them.
const MANAGE_ITEMS = ['Add a new service', 'Change my theme color', 'Hide a service', 'Turn off deposits'];

export const ASSISTANT_SUGGESTIONS_CORE = [
  "I'm out sick tomorrow",
  'Move Ada to Monday',
  ...MANAGE_ITEMS,
  'Turn on my Gallery page',
];

export const ASSISTANT_SUGGESTIONS_FULL = [
  'How much did I make this month?',
  'Who are my top customers?',
  'When am I busiest?',
  "I'm out sick tomorrow",
  ...MANAGE_ITEMS,
];
