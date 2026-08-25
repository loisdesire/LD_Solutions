import OpenAI from 'openai';
import { logError } from './logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type AgentMessage = { role: 'user' | 'assistant'; content: string };

// Every agent's system prompt already says "no markdown" - that instruction
// is not reliably followed on its own (confirmed live: the dashboard
// assistant produced "**Promotions and Discounts:**" style bold markup
// despite its prompt explicitly forbidding it), and none of these surfaces
// render markdown - WhatsApp/Telegram show it as literal asterisks, and the
// admin chat UIs (AssistantChat.tsx) are a plain whitespace-pre-wrap bubble,
// not a markdown renderer. Shared here (was previously copied only inside
// whatsappAgent.ts) so every runToolAgent caller can pass it as
// `postProcess` and get the same deterministic guarantee, rather than
// re-trusting the prompt in each new agent.
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
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }
      // A tool that throws used to take the entire request down with it -
      // executeTool was awaited unguarded, so one bad date string became a
      // 500 for the user instead of a sentence from the assistant. Hand the
      // failure back to the model as a tool result: it can apologise or try
      // a different call, which is always better than the whole turn dying.
      let result: unknown;
      try {
        result = await executeTool(toolCall.function.name, args);
      } catch (err) {
        logError('agentLoop:executeTool', err, { tool: toolCall.function.name });
        result = { error: 'That lookup failed. Tell the user you could not retrieve it right now, and do not retry the same call.' };
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
