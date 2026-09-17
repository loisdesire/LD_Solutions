// Shared between the full /admin/assistant page and the floating
// AdminAssistantWidget (every other admin page) - one list, so the
// starter prompts someone sees don't depend on which of the two they
// happened to open.
//
// Grouped, not one flat list - "Move Ada to Monday" and "Who are my top
// customers?" are different kinds of ask (one changes something, one
// doesn't), even though they go to the same thread. See AssistantChat.tsx
// for why this stays one assistant rather than two separate tools.
//
// "Manage your business" was a real, working capability this same
// assistant already had - create/update a service, change hours, update
// the logo, toggle settings (see lib/manageAgent.ts's full tool list) -
// with zero discoverability: nothing here ever suggested it existed. A
// blank chat box doesn't tell anyone it can do more than reschedule and
// answer questions. Not BI-gated like "Ask" - managing services/hours
// isn't an analytics feature, every plan gets it, so it's in both lists.
const MANAGE_GROUP = {
  label: 'Manage your business',
  items: ['Add a new service, Braiding, ₦8,000, 90 minutes', 'Change my opening hours', 'Turn off deposits for now'],
};

export const ASSISTANT_SUGGESTIONS_CORE = [
  {
    label: 'Change something',
    items: ["I'm out sick tomorrow 9am to 1pm", 'Move Ada to Monday', 'Block off next Tuesday afternoon'],
  },
  MANAGE_GROUP,
];

export const ASSISTANT_SUGGESTIONS_FULL = [
  { label: 'Ask', items: ['How much did I make this month?', 'Who are my top customers?', 'When am I busiest?'] },
  { label: 'Change something', items: ["I'm out sick tomorrow 9am to 1pm"] },
  MANAGE_GROUP,
];
