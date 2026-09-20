import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The one OpenAI tool-calling loop shared by every agent in this codebase,
// and specifically the home of the real enforcement behind "propose_* /
// apply_* only ever happens two turns apart, never chained by the model
// on its own" - a guarantee every propose/apply system prompt claims but,
// per this file's own comment, used to rest entirely on the model
// choosing to follow it: "the owner's own assistant called
// propose_create_service and apply_create_service back to back inside
// ONE turn, creating a real service before any text ever reached the
// owner to approve or decline." Zero tests existed for the one place that
// bug was actually fixed.
const createMock = vi.fn();
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: (...args: unknown[]) => createMock(...args) } };
  },
}));

const { runToolAgent, stripMarkdown } = await import('./agentLoop');

function textCompletion(content: string) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: undefined } }] };
}

function toolCallCompletion(calls: { id: string; name: string; args: Record<string, unknown> }[]) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('stripMarkdown', () => {
  it('strips **bold** markers but keeps the inner text', () => {
    expect(stripMarkdown('Your **Haircut** is booked')).toBe('Your Haircut is booked');
  });

  it('strips bare asterisks left over from bullet lists - the following space is left as-is, not separately trimmed', () => {
    expect(stripMarkdown('* Haircut\n* Beard trim')).toBe(' Haircut\n Beard trim');
  });

  it('strips markdown headers at the start of a line', () => {
    expect(stripMarkdown('# Promotions\nSave 10% today')).toBe('Promotions\nSave 10% today');
  });

  it('leaves a [label](url) link completely untouched - deliberately still allowed', () => {
    expect(stripMarkdown('See [your booking](https://vanovahub.com/x)')).toBe('See [your booking](https://vanovahub.com/x)');
  });
});

describe('runToolAgent', () => {
  const baseParams = {
    systemPrompt: 'You are a helpful assistant.',
    history: [],
    tools: [],
  };

  it('returns the model’s plain-text reply, postProcessed, when it makes no tool calls at all', async () => {
    createMock.mockResolvedValueOnce(textCompletion('**Hi** there'));
    const result = await runToolAgent({
      ...baseParams,
      message: 'hello',
      executeTool: async () => ({}),
      postProcess: (text) => text.toUpperCase(),
    });
    expect(result).toBe('**HI** THERE');
  });

  it('calls executeTool with the parsed arguments and feeds the result back for a final reply', async () => {
    const executeTool = vi.fn().mockResolvedValue({ slots: ['10:00'] });
    createMock
      .mockResolvedValueOnce(toolCallCompletion([{ id: 'call_1', name: 'check_availability', args: { date: '2026-06-01' } }]))
      .mockResolvedValueOnce(textCompletion('We have 10am free'));

    const result = await runToolAgent({ ...baseParams, message: 'what times', executeTool });

    expect(executeTool).toHaveBeenCalledWith('check_availability', { date: '2026-06-01' });
    expect(result).toBe('We have 10am free');
  });

  it('falls back to an empty args object rather than throwing on malformed tool-call JSON', async () => {
    const executeTool = vi.fn().mockResolvedValue({ ok: true });
    createMock.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_hours', arguments: '{not valid json' } }] } }],
    });
    createMock.mockResolvedValueOnce(textCompletion('done'));

    await runToolAgent({ ...baseParams, message: 'hours?', executeTool });
    expect(executeTool).toHaveBeenCalledWith('get_hours', {});
  });

  it('hands a thrown tool error back to the model as a tool result instead of letting it crash the whole turn', async () => {
    const executeTool = vi.fn().mockRejectedValue(new Error('db exploded'));
    createMock
      .mockResolvedValueOnce(toolCallCompletion([{ id: 'c1', name: 'get_hours', args: {} }]))
      .mockResolvedValueOnce(textCompletion('Sorry, could not check that'));

    const result = await runToolAgent({ ...baseParams, message: 'hours?', executeTool });

    expect(result).toBe('Sorry, could not check that');
    // The tool result the model actually saw was a friendly error, not a thrown exception.
    const secondCallArgs = createMock.mock.calls[1][0];
    const toolResultMessage = secondCallArgs.messages.find((m: any) => m.role === 'tool');
    expect(JSON.parse(toolResultMessage.content).error).toMatch(/could not retrieve it/);
  });

  it('refuses an apply_* call in the SAME turn as its matching propose_* - the actual fix for the live double-write bug', async () => {
    const executeTool = vi.fn().mockResolvedValue({ proposed: true });
    createMock
      .mockResolvedValueOnce(
        toolCallCompletion([
          { id: 'c1', name: 'propose_create_service', args: { name: 'Haircut' } },
          { id: 'c2', name: 'apply_create_service', args: { name: 'Haircut' } },
        ])
      )
      .mockResolvedValueOnce(textCompletion('Here is what I would create - confirm?'));

    await runToolAgent({ ...baseParams, message: 'add a haircut service', executeTool });

    // propose_create_service really ran (it's read-only)...
    expect(executeTool).toHaveBeenCalledWith('propose_create_service', { name: 'Haircut' });
    // ...but apply_create_service, in the SAME turn, never reached
    // executeTool at all - it was refused before ever running.
    expect(executeTool).not.toHaveBeenCalledWith('apply_create_service', expect.anything());
  });

  it('a legitimate apply_* call with NO matching propose_* earlier in this same turn executes normally - the guard is same-turn chaining specifically, not apply_* in general', async () => {
    const executeTool = vi.fn().mockResolvedValue({ applied: true });
    createMock
      .mockResolvedValueOnce(toolCallCompletion([{ id: 'c1', name: 'apply_reschedule', args: { planId: 'plan-1' } }]))
      .mockResolvedValueOnce(textCompletion('Done, moved it.'));

    await runToolAgent({ ...baseParams, message: 'yes, do it', executeTool });

    expect(executeTool).toHaveBeenCalledWith('apply_reschedule', { planId: 'plan-1' });
  });

  it('a fresh runToolAgent call (the user’s own next message) is a clean slate - the same-turn guard never carries over across calls', async () => {
    const executeTool = vi.fn().mockResolvedValue({ ok: true });

    // Turn 1: propose only.
    createMock
      .mockResolvedValueOnce(toolCallCompletion([{ id: 'c1', name: 'propose_create_service', args: {} }]))
      .mockResolvedValueOnce(textCompletion('Confirm?'));
    await runToolAgent({ ...baseParams, message: 'add a service', executeTool });

    // Turn 2: a brand-new call (real system: a new incoming message) - the
    // matching apply_* here is the user's own actual confirmation, and must
    // be allowed to run.
    createMock
      .mockResolvedValueOnce(toolCallCompletion([{ id: 'c2', name: 'apply_create_service', args: {} }]))
      .mockResolvedValueOnce(textCompletion('Created.'));
    await runToolAgent({ ...baseParams, message: 'yes', executeTool });

    expect(executeTool).toHaveBeenCalledWith('apply_create_service', {});
  });

  it('stops after maxIterations and returns the safe fallback rather than looping forever', async () => {
    const executeTool = vi.fn().mockResolvedValue({ ok: true });
    createMock.mockResolvedValue(toolCallCompletion([{ id: 'c1', name: 'get_hours', args: {} }]));

    const result = await runToolAgent({ ...baseParams, message: 'hours?', executeTool, maxIterations: 2 });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result).toMatch(/something went wrong/);
  });

  it('only sends reasoning_effort for a gpt-5.6-family model, never the default', async () => {
    createMock.mockResolvedValueOnce(textCompletion('hi'));
    await runToolAgent({ ...baseParams, message: 'hi', executeTool: async () => ({}) });
    expect(createMock.mock.calls[0][0]).not.toHaveProperty('reasoning_effort');

    createMock.mockResolvedValueOnce(textCompletion('hi'));
    await runToolAgent({ ...baseParams, message: 'hi', executeTool: async () => ({}), model: 'gpt-5.6-mini' });
    expect(createMock.mock.calls[1][0].reasoning_effort).toBe('none');
  });
});
