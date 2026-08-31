// Shared between the full /admin/assistant page and the floating
// AdminAssistantWidget (every other admin page) - one list, so the
// starter prompts someone sees don't depend on which of the two they
// happened to open.
//
// Grouped, not one flat list - "Move Ada to Monday" and "Who are my top
// customers?" are different kinds of ask (one changes something, one
// doesn't), even though they go to the same thread. See AssistantChat.tsx
// for why this stays one assistant rather than two separate tools.
export const ASSISTANT_SUGGESTIONS_CORE = [
  {
    label: 'Change something',
    items: ["I'm out sick tomorrow 9am to 1pm", 'Move Ada to Monday', 'Block off next Tuesday afternoon'],
  },
];

export const ASSISTANT_SUGGESTIONS_FULL = [
  { label: 'Ask', items: ['How much did I make this month?', 'Who are my top customers?', 'When am I busiest?'] },
  { label: 'Change something', items: ["I'm out sick tomorrow 9am to 1pm"] },
];
