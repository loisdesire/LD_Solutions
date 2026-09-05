// Shared between the client-side bubble splitter (components/AssistantChat.tsx)
// and any server-side system prompt that wants to ask for more than one
// bubble in a single reply - one literal string, defined once, so the two
// sides can never drift out of sync. A real token, not markdown or a
// newline convention, so it can't collide with anything a model would
// naturally write on its own.
export const BUBBLE_SPLIT_MARKER = '[[NEXT_BUBBLE]]';
