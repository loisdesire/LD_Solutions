import { beforeEach, describe, expect, it, vi } from 'vitest';

// Almost entirely prompt text - the only real logic in this file is what
// it wires into the shared runToolAgent loop (already fully covered in
// lib/agentLoop.test.ts) and how it folds an attached-image line into the
// message. Reuses MANAGE_TOOLS/executeManageTool as-is (see the file's own
// comment), so this file just proves that wiring, not manageAgent's own
// dispatch logic (covered in lib/manageAgent.test.ts).
const executeManageToolMock = vi.fn();
vi.mock('./manageAgent', () => ({
  MANAGE_TOOLS: [{ type: 'function', function: { name: 'propose_create_service' } }],
  executeManageTool: (...args: unknown[]) => executeManageToolMock(...args),
}));

const runToolAgentMock = vi.fn().mockResolvedValue('final reply');
vi.mock('./agentLoop', () => ({
  runToolAgent: (...args: unknown[]) => runToolAgentMock(...args),
  stripMarkdown: (s: string) => s,
}));

vi.mock('./getBusinessTimezone', () => ({ getBusinessTimezone: vi.fn().mockResolvedValue('UTC') }));
vi.mock('./timezone', () => ({ dateGroundingBlock: () => 'DATE GROUNDING' }));

const { runOnboardingAgent } = await import('./onboardingAgent');

const BASE_PARAMS = {
  businessId: 'biz-1',
  businessName: 'Glow Salon',
  history: [],
  progress: {
    profileDone: false,
    servicesDone: false,
    hoursDone: false,
    allDone: false,
    slug: 'glow-salon',
    hasLogo: false,
    hasDescription: false,
    hasCoverImage: false,
    servicesCount: 0,
    hoursCount: 0,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  runToolAgentMock.mockResolvedValue('final reply');
  executeManageToolMock.mockResolvedValue({ ok: true });
});

describe('runOnboardingAgent', () => {
  it('wires MANAGE_TOOLS, a maxIterations of 12 (not the shared default of 5), and stripMarkdown as postProcess', async () => {
    await runOnboardingAgent({ ...BASE_PARAMS, message: 'hi' });
    const params = runToolAgentMock.mock.calls[0][0];
    expect(params.tools).toEqual([{ type: 'function', function: { name: 'propose_create_service' } }]);
    expect(params.maxIterations).toBe(12);
    expect(typeof params.postProcess).toBe('function');
  });

  it('routes executeTool straight to executeManageTool, scoped to this businessId', async () => {
    await runOnboardingAgent({ ...BASE_PARAMS, message: 'add a haircut service' });
    const executeTool = runToolAgentMock.mock.calls[0][0].executeTool;
    await executeTool('propose_create_service', { services: [{ name: 'Haircut' }] });
    expect(executeManageToolMock).toHaveBeenCalledWith('propose_create_service', { services: [{ name: 'Haircut' }] }, 'biz-1');
  });

  it('appends an [Attached image: url] line to the message when imageUrl is given', async () => {
    await runOnboardingAgent({ ...BASE_PARAMS, message: 'here is my logo', imageUrl: 'https://verified/logo.jpg' });
    expect(runToolAgentMock.mock.calls[0][0].message).toBe('here is my logo\n\n[Attached image: https://verified/logo.jpg]');
  });

  it('leaves the message untouched when there is no image', async () => {
    await runOnboardingAgent({ ...BASE_PARAMS, message: 'my business is called Glow Salon' });
    expect(runToolAgentMock.mock.calls[0][0].message).toBe('my business is called Glow Salon');
  });

  it('returns whatever runToolAgent produced', async () => {
    runToolAgentMock.mockResolvedValue('Welcome, Glow Salon!');
    const result = await runOnboardingAgent({ ...BASE_PARAMS, message: 'hi' });
    expect(result).toBe('Welcome, Glow Salon!');
  });

  it('reflects missing-vs-present progress fields into the system prompt so the model has real status, not a guess', async () => {
    await runOnboardingAgent({
      ...BASE_PARAMS,
      message: 'hi',
      progress: { ...BASE_PARAMS.progress, hasLogo: true, hasDescription: false, hasCoverImage: false, servicesCount: 2, hoursCount: 5 },
    });
    const prompt = runToolAgentMock.mock.calls[0][0].systemPrompt as string;
    expect(prompt).toMatch(/Logo: added/);
    expect(prompt).toMatch(/Business description: MISSING/);
    expect(prompt).toMatch(/2 services added/);
    expect(prompt).toMatch(/5 days with hours set/);
  });
});
