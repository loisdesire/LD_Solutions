import { beforeEach, describe, expect, it, vi } from 'vitest';

// The customer-facing chat loop - orchestration (runWhatsappAgent) plus a
// local, unexported tool dispatcher (executeTool). runToolAgent itself is
// already fully covered in lib/agentLoop.test.ts, so it's mocked here to a
// capturable stand-in: this file only needs to prove runWhatsappAgent wires
// the right tools/executeTool/context into it, and that executeTool maps
// each OpenAI tool call to the right whatsappTools.ts function with the
// right args - not re-verify the loop mechanics themselves.
const runToolAgentMock = vi.fn().mockResolvedValue('final reply');
vi.mock('./agentLoop', () => ({
  runToolAgent: (...args: unknown[]) => runToolAgentMock(...args),
  stripMarkdown: (s: string) => s,
}));

const whatsappTools = {
  checkAvailability: vi.fn(),
  createBooking: vi.fn(),
  findCustomerBookings: vi.fn(),
  cancelBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  getBusinessContext: vi.fn(),
  getPopularServices: vi.fn(),
  getBusyTimes: vi.fn(),
  loadConversation: vi.fn(),
  saveConversation: vi.fn(),
  checkPayment: vi.fn(),
  requestOwnerReview: vi.fn(),
};
vi.mock('./whatsappTools', () => whatsappTools);

vi.mock('./timezone', () => ({ dateGroundingBlock: () => 'DATE GROUNDING' }));
vi.mock('./formatMoney', () => ({ formatMoney: (n: number) => `₦${n}` }));

const hasBusinessIntelligenceMock = vi.fn();
vi.mock('./subscription-server', () => ({ hasBusinessIntelligence: (...args: unknown[]) => hasBusinessIntelligenceMock(...args) }));

const { runWhatsappAgent, MAX_HISTORY } = await import('./whatsappAgent');

const BIZ = 'biz-1';
const PHONE = '+2348000000001';

function business(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    business: { name: 'Glow Salon', timezone: 'UTC', contact_phone: null, contact_email: null, instagram_url: null, facebook_url: null, ai_context: null, ...overrides },
    services: [],
    weeklyHours: ['Mon-Fri 9-6'],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  runToolAgentMock.mockResolvedValue('final reply');
  whatsappTools.getBusinessContext.mockResolvedValue(business());
  whatsappTools.loadConversation.mockResolvedValue([]);
  hasBusinessIntelligenceMock.mockResolvedValue(false);
});

describe('runWhatsappAgent - orchestration', () => {
  it('returns a plain apology and never calls runToolAgent when the business cannot be found', async () => {
    whatsappTools.getBusinessContext.mockResolvedValue({ business: null, services: [], weeklyHours: [] });

    const result = await runWhatsappAgent({ businessId: BIZ, customerPhone: PHONE, incomingText: 'hi' });

    expect(result).toMatch(/couldn.t find this business/);
    expect(runToolAgentMock).not.toHaveBeenCalled();
  });

  it('omits the get_popular_services tool entirely when the business is not on the Business Intelligence plan', async () => {
    hasBusinessIntelligenceMock.mockResolvedValue(false);
    await runWhatsappAgent({ businessId: BIZ, customerPhone: PHONE, incomingText: 'hi' });
    const params = runToolAgentMock.mock.calls[0][0];
    const names = params.tools.map((t: { function: { name: string } }) => t.function.name);
    expect(names).not.toContain('get_popular_services');
  });

  it('includes get_popular_services only when the business is on the Business Intelligence plan', async () => {
    hasBusinessIntelligenceMock.mockResolvedValue(true);
    await runWhatsappAgent({ businessId: BIZ, customerPhone: PHONE, incomingText: 'hi' });
    const params = runToolAgentMock.mock.calls[0][0];
    const names = params.tools.map((t: { function: { name: string } }) => t.function.name);
    expect(names).toContain('get_popular_services');
  });

  it('saves the updated conversation, appending the user turn and the final reply, trimmed to MAX_HISTORY', async () => {
    const longHistory = Array.from({ length: MAX_HISTORY }, (_, i) => ({ role: 'user' as const, content: `msg ${i}` }));
    whatsappTools.loadConversation.mockResolvedValue(longHistory);

    await runWhatsappAgent({ businessId: BIZ, customerPhone: PHONE, incomingText: 'book me a haircut' });

    const [savedBizId, savedPhone, savedHistory] = whatsappTools.saveConversation.mock.calls[0];
    expect(savedBizId).toBe(BIZ);
    expect(savedPhone).toBe(PHONE);
    expect(savedHistory).toHaveLength(MAX_HISTORY);
    expect(savedHistory[savedHistory.length - 1]).toEqual({ role: 'assistant', content: 'final reply' });
    expect(savedHistory[savedHistory.length - 2]).toEqual({ role: 'user', content: 'book me a haircut' });
  });

  it('returns whatever runToolAgent produced as the final reply', async () => {
    runToolAgentMock.mockResolvedValue('We have 10am free.');
    const result = await runWhatsappAgent({ businessId: BIZ, customerPhone: PHONE, incomingText: 'availability?' });
    expect(result).toBe('We have 10am free.');
  });
});

describe('runWhatsappAgent - executeTool dispatch (captured from the runToolAgent call)', () => {
  async function getExecuteTool() {
    await runWhatsappAgent({ businessId: BIZ, customerPhone: PHONE, incomingText: 'hi' });
    return runToolAgentMock.mock.calls[0][0].executeTool as (name: string, args: Record<string, unknown>) => Promise<unknown>;
  }

  it('check_availability coerces service_name/date to strings and scopes to the ctx', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('check_availability', { service_name: 'Haircut', date: '2026-06-01' });
    expect(whatsappTools.checkAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BIZ, customerPhone: PHONE }),
      { serviceName: 'Haircut', date: '2026-06-01' }
    );
  });

  it('create_booking leaves customerEmail undefined when the customer never gave one', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('create_booking', { service_name: 'Haircut', date: '2026-06-01', time: '10:00', customer_name: 'Jane' });
    const [, arg] = whatsappTools.createBooking.mock.calls[0];
    expect(arg.customerEmail).toBeUndefined();
  });

  it('create_booking passes customerEmail through when given', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('create_booking', { service_name: 'Haircut', date: '2026-06-01', time: '10:00', customer_name: 'Jane', customer_email: 'jane@x.com' });
    const [, arg] = whatsappTools.createBooking.mock.calls[0];
    expect(arg.customerEmail).toBe('jane@x.com');
  });

  it('find_customer_bookings takes no args, just the ctx', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('find_customer_bookings', {});
    expect(whatsappTools.findCustomerBookings).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ }));
  });

  it('cancel_booking leaves confirmContact undefined until the tool itself asks for it', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('cancel_booking', { service_name: 'Haircut', date: '2026-06-01', time: '10:00' });
    const [, arg] = whatsappTools.cancelBooking.mock.calls[0];
    expect(arg.confirmContact).toBeUndefined();
  });

  it('cancel_booking passes confirm_contact through once given', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('cancel_booking', { service_name: 'Haircut', date: '2026-06-01', time: '10:00', confirm_contact: 'jane@x.com' });
    const [, arg] = whatsappTools.cancelBooking.mock.calls[0];
    expect(arg.confirmContact).toBe('jane@x.com');
  });

  it('reschedule_booking maps both the current and new date/time', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('reschedule_booking', {
      service_name: 'Haircut', date: '2026-06-01', time: '10:00', new_date: '2026-06-02', new_time: '11:00',
    });
    expect(whatsappTools.rescheduleBooking).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BIZ }),
      { serviceName: 'Haircut', date: '2026-06-01', time: '10:00', newDate: '2026-06-02', newTime: '11:00', confirmContact: undefined }
    );
  });

  it('check_payment takes no args, just the ctx', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('check_payment', {});
    expect(whatsappTools.checkPayment).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ }));
  });

  it('get_busy_times is scoped straight to the businessId', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('get_busy_times', {});
    expect(whatsappTools.getBusyTimes).toHaveBeenCalledWith(BIZ);
  });

  it('request_owner_review leaves customerName undefined when not given', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('request_owner_review', { question: 'Can they bring their own product?' });
    const [, arg] = whatsappTools.requestOwnerReview.mock.calls[0];
    expect(arg).toEqual({ question: 'Can they bring their own product?', customerName: undefined });
  });

  it('get_popular_services is intercepted before the switch and scoped straight to the businessId', async () => {
    const executeTool = await getExecuteTool();
    await executeTool('get_popular_services', { limit: 2 });
    expect(whatsappTools.getPopularServices).toHaveBeenCalledWith(BIZ, { limit: 2 });
  });

  it('returns an error object for an unknown tool name rather than throwing', async () => {
    const executeTool = await getExecuteTool();
    const result = await executeTool('not_a_real_tool', {});
    expect(result).toEqual({ error: 'Unknown tool: not_a_real_tool' });
  });
});
