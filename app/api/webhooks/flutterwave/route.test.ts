import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Every real subscription payment and every real chat-booking deposit
// reaches the app through this one route - it had no route-level test at
// all before this. Covers: the signature gate itself (the exact timing-
// leak class of bug this webhook already shipped live once, per its own
// comment), the chat-booking-deposit branch (delegates to
// confirmPaidBooking, already covered by its own tests - this only
// checks the routing/escalation around it), and the subscription-payment
// branch (matching by tx_ref then falling back to the Flutterwave
// subscription id, recording payment_history, and flipping the
// subscription's own status) - including the subscription-activation
// update whose own unchecked error this pass just fixed.
const subscriptionsSelectQuery = vi.fn();
const subscriptionsUpdateQuery = vi.fn();
const paymentHistoryInsertQuery = vi.fn();
let subscriptionsUpdatePayloads: Record<string, unknown>[] = [];
let paymentHistoryInsertPayloads: Record<string, unknown>[] = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'subscriptions') {
        const self: any = {
          select: () => self,
          eq: () => self,
          maybeSingle: () => Promise.resolve(subscriptionsSelectQuery()),
          update: (arg: Record<string, unknown>) => {
            subscriptionsUpdatePayloads.push(arg);
            const updateSelf: any = {
              eq: () => Promise.resolve(subscriptionsUpdateQuery()),
            };
            return updateSelf;
          },
        };
        return self;
      }
      if (table === 'payment_history') {
        return {
          insert: (arg: Record<string, unknown>) => {
            paymentHistoryInsertPayloads.push(arg);
            return Promise.resolve(paymentHistoryInsertQuery());
          },
        };
      }
      throw new Error(`test double doesn't expect a query against "${table}"`);
    },
  }),
}));

const rateLimitMock = vi.fn();
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  getClientIp: () => '127.0.0.1',
}));

const logErrorMock = vi.fn();
vi.mock('@/lib/logger', () => ({ logError: (...args: unknown[]) => logErrorMock(...args) }));

const confirmPaidBookingMock = vi.fn();
vi.mock('@/lib/whatsappTools', () => ({
  confirmPaidBooking: (...args: unknown[]) => confirmPaidBookingMock(...args),
}));

const { POST } = await import('./route');

const SECRET = 'a-real-webhook-secret-hash';

function req(body: unknown, { signature = SECRET }: { signature?: string | null } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (signature !== null) headers.set('verif-hash', signature);
  return new NextRequest('http://localhost/api/webhooks/flutterwave', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.FLUTTERWAVE_SECRET_HASH = SECRET;
  rateLimitMock.mockResolvedValue(true);
  subscriptionsUpdateQuery.mockResolvedValue({ error: null });
  paymentHistoryInsertQuery.mockResolvedValue({ error: null });
  subscriptionsUpdatePayloads = [];
  paymentHistoryInsertPayloads = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FLUTTERWAVE_SECRET_HASH;
});

describe('POST /api/webhooks/flutterwave - signature gate', () => {
  it('403s a request with no signature header at all', async () => {
    const res = await POST(req({ data: {} }, { signature: null }));
    expect(res.status).toBe(403);
  });

  it('403s a request whose signature does not match the configured secret', async () => {
    const res = await POST(req({ data: {} }, { signature: 'a-wrong-guess' }));
    expect(res.status).toBe(403);
  });

  it('403s every request when FLUTTERWAVE_SECRET_HASH is unset, even one with an empty signature header - an unconfigured secret must never accept anything', async () => {
    delete process.env.FLUTTERWAVE_SECRET_HASH;
    const res = await POST(req({ data: {} }, { signature: '' }));
    expect(res.status).toBe(403);
  });

  it('429s before ever checking the signature when the request is rate-limited', async () => {
    rateLimitMock.mockResolvedValueOnce(false);
    const res = await POST(req({ data: {} }, { signature: 'anything' }));
    expect(res.status).toBe(429);
  });

  it('accepts the real configured secret and proceeds past the signature check', async () => {
    subscriptionsSelectQuery.mockResolvedValueOnce({ data: null });
    const res = await POST(req({ data: { tx_ref: 'web_x' } }));
    // Gets past 403 - reaches the "no matching subscription" branch,
    // which still replies 200 (see its own test below).
    expect(res.status).toBe(200);
  });
});

describe('POST /api/webhooks/flutterwave - chat booking deposits', () => {
  it('routes a chat-booking tx_ref straight to confirmPaidBooking, never touching the subscriptions table', async () => {
    confirmPaidBookingMock.mockResolvedValueOnce({ confirmed: true });
    const bookingId = '11111111-1111-4111-8111-111111111111';

    const res = await POST(req({ data: { tx_ref: `chat_${bookingId}_ab12cd34` } }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, confirmed: true, reason: undefined });
    expect(confirmPaidBookingMock).toHaveBeenCalledWith(bookingId, `chat_${bookingId}_ab12cd34`);
    expect(subscriptionsSelectQuery).not.toHaveBeenCalled();
  });

  it('alerts critically when payment lands after the hold already expired and the slot was lost', async () => {
    confirmPaidBookingMock.mockResolvedValueOnce({ confirmed: false, reason: 'slot_taken' });
    const bookingId = '22222222-2222-4222-8222-222222222222';

    const res = await POST(req({ data: { tx_ref: `chat_${bookingId}_ff00ff00` } }));

    expect(res.status).toBe(200);
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/webhooks/flutterwave:paid-slot-lost',
      expect.any(Error),
      { bookingId },
      { critical: true }
    );
  });

  it('never routes a web-booking tx_ref (no embedded booking id) into the chat-deposit branch', async () => {
    subscriptionsSelectQuery.mockResolvedValueOnce({ data: null });
    const res = await POST(req({ data: { tx_ref: 'web_550e8400-e29b-41d4-a716-446655440000' } }));
    expect(res.status).toBe(200);
    expect(confirmPaidBookingMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/flutterwave - subscription payments', () => {
  it('replies ok without writing anything when no subscription matches either the tx_ref or the Flutterwave subscription id', async () => {
    subscriptionsSelectQuery.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: null });

    const res = await POST(req({ data: { tx_ref: 'sub_unknown', flw_ref: 'flw_unknown', status: 'successful' } }));

    expect(res.status).toBe(200);
    expect(paymentHistoryInsertPayloads).toHaveLength(0);
    expect(logErrorMock).toHaveBeenCalledWith('api/webhooks/flutterwave:no-match', expect.any(Error), expect.anything());
  });

  it('falls back to matching by the Flutterwave subscription id for a renewal charge, whose tx_ref is new each cycle', async () => {
    subscriptionsSelectQuery
      .mockResolvedValueOnce({ data: null }) // no match by tx_ref
      .mockResolvedValueOnce({ data: { id: 'sub-row-1', business_id: 'biz-1' } }); // matched by flw subscription id

    const res = await POST(req({ data: { tx_ref: 'sub_new_cycle_ref', flw_ref: 'flw_sub_123', status: 'successful' } }));

    expect(res.status).toBe(200);
    expect(paymentHistoryInsertPayloads[0]).toMatchObject({ business_id: 'biz-1', status: 'successful' });
  });

  it('records payment_history and activates the subscription on a successful charge', async () => {
    subscriptionsSelectQuery.mockResolvedValueOnce({ data: { id: 'sub-row-1', business_id: 'biz-1' } });

    const res = await POST(req({ data: { tx_ref: 'sub_ref_1', amount: 15000, status: 'successful' } }));

    expect(res.status).toBe(200);
    expect(paymentHistoryInsertPayloads[0]).toMatchObject({ business_id: 'biz-1', amount: 15000, status: 'successful' });
    expect(subscriptionsUpdatePayloads[0]).toMatchObject({ status: 'active', past_due_warning_sent_at: null });
  });

  it('marks the subscription past_due on a failed charge, without touching payment_history’s success/failure framing incorrectly', async () => {
    subscriptionsSelectQuery.mockResolvedValueOnce({ data: { id: 'sub-row-1', business_id: 'biz-1' } });

    const res = await POST(req({ data: { tx_ref: 'sub_ref_1', status: 'failed' } }));

    expect(res.status).toBe(200);
    expect(paymentHistoryInsertPayloads[0]).toMatchObject({ status: 'failed' });
    expect(subscriptionsUpdatePayloads[0]).toMatchObject({ status: 'past_due' });
  });

  it('alerts critically when the payment_history insert itself fails - that row is the whole "Payment history" list on the billing page', async () => {
    subscriptionsSelectQuery.mockResolvedValueOnce({ data: { id: 'sub-row-1', business_id: 'biz-1' } });
    paymentHistoryInsertQuery.mockResolvedValueOnce({ error: { message: 'insert failed' } });

    const res = await POST(req({ data: { tx_ref: 'sub_ref_1', status: 'successful' } }));

    expect(res.status).toBe(200);
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/webhooks/flutterwave:payment-history-record-failed',
      expect.anything(),
      expect.objectContaining({ businessId: 'biz-1' }),
      { critical: true }
    );
  });

  it('alerts critically when the activation update itself fails - a business that genuinely paid must not silently stay locked out', async () => {
    subscriptionsSelectQuery.mockResolvedValueOnce({ data: { id: 'sub-row-1', business_id: 'biz-1' } });
    subscriptionsUpdateQuery.mockResolvedValueOnce({ error: { message: 'update failed' } });

    const res = await POST(req({ data: { tx_ref: 'sub_ref_1', status: 'successful' } }));

    expect(res.status).toBe(200);
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/webhooks/flutterwave:activate-failed',
      expect.anything(),
      expect.objectContaining({ businessId: 'biz-1', subscriptionId: 'sub-row-1' }),
      { critical: true }
    );
  });
});
