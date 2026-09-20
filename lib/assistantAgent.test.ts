import { beforeEach, describe, expect, it, vi } from 'vitest';

// The owner-facing assistant. runToolAgent itself is fully covered in
// lib/agentLoop.test.ts, so it's mocked to a capturable stand-in here -
// this file's real job is the routing/patching logic that lives directly
// in runAssistantAgent's executeTool closure, which carries three
// confirmed-live bug fixes of its own:
//   1. tool-name routing by scanning each tool-set's own schema, so a
//      reschedule/manage/insights tool always reaches the right
//      dispatcher even as new tools get added to any of the three;
//   2. patching a missing changes.image_url onto propose/apply_update_service
//      from the request's own already-verified imageUrl, because the model
//      sometimes resupplied the wrong (or no) url on the apply step of a
//      confirm-with-photo flow;
//   3. auto-applying propose_update_service immediately, in the same turn,
//      for a PURE photo change (attaching the file IS the confirmation) -
//      but never for a change that touches any other field, which still
//      requires the owner's explicit yes.
const executeRescheduleToolMock = vi.fn();
const executeManageToolMock = vi.fn();
const executeInsightsToolMock = vi.fn();
vi.mock('./rescheduleAgent', () => ({
  RESCHEDULE_TOOLS: [{ type: 'function', function: { name: 'propose_reschedule' } }, { type: 'function', function: { name: 'apply_reschedule' } }],
  executeRescheduleTool: (...args: unknown[]) => executeRescheduleToolMock(...args),
}));
vi.mock('./manageAgent', () => ({
  MANAGE_TOOLS: [
    { type: 'function', function: { name: 'propose_update_service' } },
    { type: 'function', function: { name: 'apply_update_service' } },
    { type: 'function', function: { name: 'propose_update_profile' } },
    { type: 'function', function: { name: 'apply_update_profile' } },
  ],
  executeManageTool: (...args: unknown[]) => executeManageToolMock(...args),
}));
vi.mock('./insightsAgent', () => ({
  INSIGHTS_TOOLS: [{ type: 'function', function: { name: 'get_revenue' } }],
  executeInsightsTool: (...args: unknown[]) => executeInsightsToolMock(...args),
}));

const runToolAgentMock = vi.fn().mockResolvedValue('final reply');
vi.mock('./agentLoop', () => ({
  runToolAgent: (...args: unknown[]) => runToolAgentMock(...args),
  stripMarkdown: (s: string) => s,
}));

vi.mock('./getBusinessTimezone', () => ({ getBusinessTimezone: vi.fn().mockResolvedValue('UTC') }));
vi.mock('./timezone', () => ({ dateGroundingBlock: () => 'DATE GROUNDING' }));
vi.mock('./formatMoney', () => ({ formatMoney: (n: number) => `₦${n}` }));

const describeManageToolChangeMock = vi.fn();
const notifyOwnerOfManageChangeMock = vi.fn();
vi.mock('./notifyOwnerOfChange', () => ({
  describeManageToolChange: (...args: unknown[]) => describeManageToolChangeMock(...args),
  notifyOwnerOfManageChange: (...args: unknown[]) => notifyOwnerOfManageChangeMock(...args),
}));

const getBusinessContextMock = vi.fn();
vi.mock('./whatsappTools', () => ({ getBusinessContext: (...args: unknown[]) => getBusinessContextMock(...args) }));

const { runAssistantAgent } = await import('./assistantAgent');

const BIZ = 'biz-1';
const BASE_PARAMS = { businessId: BIZ, businessName: 'Glow Salon', slug: 'glow-salon', history: [], analyticsEnabled: true };

beforeEach(() => {
  vi.clearAllMocks();
  runToolAgentMock.mockResolvedValue('final reply');
  getBusinessContextMock.mockResolvedValue({ business: {}, services: [], weeklyHours: ['Mon-Fri 9-6'] });
  executeRescheduleToolMock.mockResolvedValue({ ok: true });
  executeManageToolMock.mockResolvedValue({ ok: true });
  executeInsightsToolMock.mockResolvedValue({ ok: true });
  describeManageToolChangeMock.mockReturnValue(null);
});

async function getExecuteTool(params: Partial<Parameters<typeof runAssistantAgent>[0]> = {}) {
  await runAssistantAgent({ ...BASE_PARAMS, message: 'hello', ...params });
  return runToolAgentMock.mock.calls[0][0].executeTool as (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

describe('runAssistantAgent - tool set composition', () => {
  it('offers reschedule + manage + insights tools when analytics is enabled', async () => {
    await runAssistantAgent({ ...BASE_PARAMS, message: 'hi', analyticsEnabled: true });
    const names = runToolAgentMock.mock.calls[0][0].tools.map((t: { function: { name: string } }) => t.function.name);
    expect(names).toEqual(expect.arrayContaining(['propose_reschedule', 'propose_update_service', 'get_revenue']));
  });

  it('drops insights tools entirely when analytics is disabled - a core-plan owner cannot reach them no matter what they ask', async () => {
    await runAssistantAgent({ ...BASE_PARAMS, message: 'hi', analyticsEnabled: false });
    const names = runToolAgentMock.mock.calls[0][0].tools.map((t: { function: { name: string } }) => t.function.name);
    expect(names).not.toContain('get_revenue');
  });

  it('uses the gpt-5.6-luna model, not the shared default', async () => {
    await runAssistantAgent({ ...BASE_PARAMS, message: 'hi' });
    expect(runToolAgentMock.mock.calls[0][0].model).toBe('gpt-5.6-luna');
  });
});

describe('runAssistantAgent - executeTool routing by tool-set membership', () => {
  it('routes a reschedule-tool name to executeRescheduleTool', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('propose_reschedule', { date: '2026-06-01' });
    expect(executeRescheduleToolMock).toHaveBeenCalledWith('propose_reschedule', { date: '2026-06-01' }, BIZ);
  });

  it('routes a manage-tool name (not update_service) to executeManageTool, and fires the owner-notification email when a change summary exists', async () => {
    describeManageToolChangeMock.mockReturnValue('Updated the Haircut price to ₦6000.');
    executeManageToolMock.mockResolvedValue({ applied: true });

    const executeTool = await getExecuteTool();
    await executeTool('apply_update_profile', { name: 'New Name' });

    expect(executeManageToolMock).toHaveBeenCalledWith('apply_update_profile', { name: 'New Name' }, BIZ);
    expect(notifyOwnerOfManageChangeMock).toHaveBeenCalledWith(BIZ, 'Updated the Haircut price to ₦6000.', 'Glow Salon');
  });

  it('does not send an owner-notification email when describeManageToolChange returns nothing (e.g. a propose_* call, not a real write)', async () => {
    describeManageToolChangeMock.mockReturnValue(null);
    const executeTool = await getExecuteTool();
    await executeTool('apply_update_profile', { name: 'New Name' });
    expect(notifyOwnerOfManageChangeMock).not.toHaveBeenCalled();
  });

  it('routes an insights-tool name to executeInsightsTool when it matches neither other tool set', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('get_revenue', { from: '2026-05-01' });
    expect(executeInsightsToolMock).toHaveBeenCalledWith('get_revenue', { from: '2026-05-01' }, BIZ);
  });
});

describe('runAssistantAgent - image_url patching onto propose/apply_update_service (bug fix #2)', () => {
  it('fills a missing changes.image_url from the request’s own verified imageUrl on apply_update_service', async () => {
    executeManageToolMock.mockResolvedValue({ applied: true });
    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });

    await executeTool('apply_update_service', { service_name: 'Haircut', changes: { price: 6000 } });

    const [, arg] = executeManageToolMock.mock.calls[0];
    expect(arg.changes.image_url).toBe('https://verified/photo.jpg');
    expect(arg.changes.price).toBe(6000);
  });

  it('never overwrites an image_url the model already supplied, even if it differs from the request’s own verified url', async () => {
    executeManageToolMock.mockResolvedValue({ applied: true });
    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });

    await executeTool('apply_update_service', { service_name: 'Haircut', changes: { image_url: 'https://model-said/other.jpg' } });

    const [, arg] = executeManageToolMock.mock.calls[0];
    expect(arg.changes.image_url).toBe('https://model-said/other.jpg');
  });

  it('leaves other manage tools (e.g. apply_update_profile) completely untouched by the patch - scoped to update_service only', async () => {
    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });
    await executeTool('apply_update_profile', { name: 'New Name' });
    const [, arg] = executeManageToolMock.mock.calls[0];
    expect(arg).not.toHaveProperty('changes');
  });

  it('does nothing when no imageUrl was attached to this request at all', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('apply_update_service', { service_name: 'Haircut', changes: { price: 6000 } });
    const [, arg] = executeManageToolMock.mock.calls[0];
    expect(arg.changes).toEqual({ price: 6000 });
  });
});

describe('runAssistantAgent - pure-photo-change auto-apply (bug fix #3)', () => {
  it('calls propose then apply in the same turn when the ONLY change is the photo, and adds a note telling the model not to ask again', async () => {
    executeManageToolMock.mockImplementation(async (name: string) => {
      if (name === 'propose_update_service') return { proposed: true };
      if (name === 'apply_update_service') return { applied: true };
      return { ok: true };
    });
    describeManageToolChangeMock.mockReturnValue('Updated the Haircut photo.');

    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });
    const result = await executeTool('propose_update_service', { service_name: 'Haircut', changes: { image_url: 'https://verified/photo.jpg' } }) as Record<string, unknown>;

    expect(executeManageToolMock).toHaveBeenCalledWith('propose_update_service', expect.anything(), BIZ);
    expect(executeManageToolMock).toHaveBeenCalledWith('apply_update_service', expect.anything(), BIZ);
    expect(result.applied).toBe(true);
    expect(result.note).toMatch(/already applied/i);
    expect(notifyOwnerOfManageChangeMock).toHaveBeenCalledWith(BIZ, 'Updated the Haircut photo.', 'Glow Salon');
  });

  it('does NOT auto-apply when the photo is one of several changes at once - a mixed change still needs the owner’s explicit confirmation', async () => {
    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });
    await executeTool('propose_update_service', { service_name: 'Haircut', changes: { image_url: 'https://verified/photo.jpg', price: 7000 } });

    expect(executeManageToolMock).toHaveBeenCalledWith('propose_update_service', expect.anything(), BIZ);
    expect(executeManageToolMock).not.toHaveBeenCalledWith('apply_update_service', expect.anything(), BIZ);
  });

  it('does NOT auto-apply when there is no imageUrl on this request at all, even if changes happens to contain only image_url', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('propose_update_service', { service_name: 'Haircut', changes: {} });
    expect(executeManageToolMock).not.toHaveBeenCalledWith('apply_update_service', expect.anything(), BIZ);
  });

  it('returns the propose result (not applying) when the pure-photo propose call itself errors', async () => {
    executeManageToolMock.mockImplementation(async (name: string) => {
      if (name === 'propose_update_service') return { error: 'Service not found' };
      return { ok: true };
    });

    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });
    const result = await executeTool('propose_update_service', { service_name: 'Haircut', changes: { image_url: 'https://verified/photo.jpg' } });

    expect(result).toEqual({ error: 'Service not found' });
    expect(executeManageToolMock).not.toHaveBeenCalledWith('apply_update_service', expect.anything(), BIZ);
  });

  it('returns the apply result unwrapped (no note) when the auto-apply itself errors', async () => {
    executeManageToolMock.mockImplementation(async (name: string) => {
      if (name === 'propose_update_service') return { proposed: true };
      if (name === 'apply_update_service') return { error: 'Could not save' };
      return { ok: true };
    });

    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });
    const result = await executeTool('propose_update_service', { service_name: 'Haircut', changes: { image_url: 'https://verified/photo.jpg' } });

    expect(result).toEqual({ error: 'Could not save' });
  });

  it('does not auto-apply propose_update_service results carrying needs_disambiguation - multiple matches still need the owner to pick one', async () => {
    executeManageToolMock.mockImplementation(async (name: string) => {
      if (name === 'propose_update_service') return { needs_disambiguation: true, matches: ['Haircut', 'Haircut Deluxe'] };
      return { ok: true };
    });

    const executeTool = await getExecuteTool({ imageUrl: 'https://verified/photo.jpg' });
    const result = await executeTool('propose_update_service', { service_name: 'Hair', changes: { image_url: 'https://verified/photo.jpg' } });

    expect(result).toEqual({ needs_disambiguation: true, matches: ['Haircut', 'Haircut Deluxe'] });
    expect(executeManageToolMock).not.toHaveBeenCalledWith('apply_update_service', expect.anything(), BIZ);
  });
});

describe('runAssistantAgent - image message folding', () => {
  it('appends an [Attached image: url] line to the message text when imageUrl is given', async () => {
    await runAssistantAgent({ ...BASE_PARAMS, message: 'update the photo', imageUrl: 'https://verified/photo.jpg' });
    expect(runToolAgentMock.mock.calls[0][0].message).toBe('update the photo\n\n[Attached image: https://verified/photo.jpg]');
  });

  it('leaves the message untouched when there is no image', async () => {
    await runAssistantAgent({ ...BASE_PARAMS, message: 'what are my hours?' });
    expect(runToolAgentMock.mock.calls[0][0].message).toBe('what are my hours?');
  });
});
