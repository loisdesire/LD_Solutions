import OpenAI from 'openai';
import { logError } from './logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type AgentMessage = { role: 'user' | 'assistant'; content: string };

// Every agent's system prompt already says "no markdown" - that instruction
// is not reliably followed on its own (confirmed live: the dashboard
// assistant produced "**Promotions and Discounts:**" style bold markup
// despite its prompt explicitly forbidding it). WhatsApp/Telegram still
// show any of this as literal characters, so it's stripped here
// regardless of surface. AssistantChat.tsx (the admin chat UIs) now
// parses **bold**/bullets/[label](/path) links client-side instead of
// rendering plain whitespace-pre-wrap text - bold and headers still get
// stripped here too as a deterministic backstop (redundant with that
// parsing for **bold**, cheap insurance for the surfaces that don't
// parse it), but [label](url) links are deliberately left untouched:
// assistantAgent.ts is now allowed to produce those on purpose (see its
// own comment), and stripping them here would defeat that. Shared here
// (was previously copied only inside whatsappAgent.ts) so every
// runToolAgent caller can pass it as `postProcess` and get the same
// deterministic guarantee, rather than re-trusting the prompt in each
// new agent.
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '');
}

// The one OpenAI tool-calling loop shared by every agent in this codebase
// (lib/whatsappAgent.ts, lib/insightsAgent.ts, lib/rescheduleAgent.ts) -
// was three copies of the identical request/response plumbing, differing
// only in system prompt, tool schemas, and what a tool call actually does.
// Each agent file still owns those real differences (that's the point of
// having three separate agents, not something to merge away); only the
// "build the conversation, keep calling tools until the model gives a
// plain answer" loop itself was duplicated.
export async function runToolAgent(params: {
  systemPrompt: string;
  history: AgentMessage[];
  message: string;
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  // Applied to the model's final plain-text reply only (never to tool
  // arguments/results). Every agent in this file's callers passes
  // stripMarkdown (below) - none of their surfaces render markdown, chat
  // app or dashboard alike. Left as a plain default-to-no-op parameter
  // rather than hardcoding the strip into the loop itself, so a future
  // agent with an actual markdown-capable surface isn't forced through it.
  postProcess?: (text: string) => string;
  maxIterations?: number;
  model?: string;
}): Promise<string> {
  const {
    systemPrompt,
    history,
    message,
    tools,
    executeTool,
    postProcess = (text) => text,
    maxIterations = 5,
    model = 'gpt-4o-mini',
  } = params;

  const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  let finalText = 'Sorry, something went wrong on our end. Please try again in a moment.';

  // Every propose_*/apply_* pair in this codebase (manageAgent.ts,
  // rescheduleAgent.ts) exists specifically so a real write only ever
  // happens once the user has seen the exact plan and said yes - every
  // one of those system prompts says so explicitly. That guarantee was
  // resting entirely on the model choosing to follow it, with nothing
  // here actually enforcing it - confirmed live: the owner's own
  // assistant called propose_create_service and apply_create_service
  // back to back inside ONE turn, creating a real service before any text
  // ever reached the owner to approve or decline. This tracks which
  // propose_* actions this SAME execution has already called; if the
  // model then tries the matching apply_* before returning to the user,
  // that call is refused rather than run - the model computing a plan is
  // not the user saying yes to it, no matter how confident the model is.
  // Scoped fresh per call (per incoming user message), so a LEGITIMATE
  // apply_* in the user's own next turn - a new runToolAgent call, a new
  // empty Set - is completely unaffected; only same-turn chaining is
  // blocked.
  const proposedThisTurn = new Set<string>();

  for (let i = 0; i < maxIterations; i++) {
    const completion = await openai.chat.completions.create({
      model,
      messages: conversation,
      tools,
      tool_choice: 'auto',
    });

    const choice = completion.choices[0].message;
    conversation.push(choice);

    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      finalText = choice.content ? postProcess(choice.content) : finalText;
      break;
    }

    for (const toolCall of choice.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const toolName = toolCall.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }

      let result: unknown;
      if (toolName.startsWith('propose_')) {
        proposedThisTurn.add(toolName.slice('propose_'.length));
      }
      const action = toolName.startsWith('apply_') ? toolName.slice('apply_'.length) : null;
      if (action && proposedThisTurn.has(action)) {
        // The real guarantee: this exact plan was proposed only moments
        // ago in this SAME turn, with no chance yet for the user to see
        // it and reply - refused rather than executed, regardless of how
        // certain the model sounds that this is what was wanted.
        result = {
          error:
            'Cannot apply this in the same turn it was proposed. Stop here, show the user exactly what would happen in plain language, and end your reply - do not call apply_* again until their OWN next message actually confirms it.',
        };
      } else {
        // A tool that throws used to take the entire request down with it -
        // executeTool was awaited unguarded, so one bad date string became a
        // 500 for the user instead of a sentence from the assistant. Hand the
        // failure back to the model as a tool result: it can apologise or try
        // a different call, which is always better than the whole turn dying.
        try {
          result = await executeTool(toolName, args);
        } catch (err) {
          logError('agentLoop:executeTool', err, { tool: toolName });
          result = { error: 'That lookup failed. Tell the user you could not retrieve it right now, and do not retry the same call.' };
        }
      }
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return finalText;
}
