import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type AgentMessage = { role: 'user' | 'assistant'; content: string };

// The one OpenAI tool-calling loop shared by every agent in this codebase
// (lib/whatsappAgent.ts, lib/insightsAgent.ts, lib/rescheduleAgent.ts) —
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
  // arguments/results) — whatsappAgent.ts uses this to strip markdown
  // before a reply reaches a chat app with no markdown rendering; the
  // dashboard agents don't need it, so it defaults to a no-op.
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
      const result = await executeTool(toolCall.function.name, args);
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return finalText;
}
