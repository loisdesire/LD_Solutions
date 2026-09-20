import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The one route in the app that reverses a real charge. Owner-only,
// moves real money, and had no test of its own. requireStaffApiSession
// itself already has full coverage (lib/requireStaffApiSession.test.ts),
// so it's mocked directly here rather than re-derived through raw
// Supabase auth/staff-lookup mocks - this file is only about what this
// route does once it's past that gate.
const bookingSelectQuery = vi.fn();
const bookingUpdateQuery = vi.fn();
let lastUpdatePayload: Record<string, unknown> | null = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'bookings') throw new Error(`test double doesn't expect a query against "${table}"`);
      const self: any = {
        select: () => self,
        eq: () => self,
        maybeSingle: () => Promise.resolve(bookingSelectQuery()),
        update: (arg: Record<string, unknown>) => {
          lastUpdatePayload = arg;
          return { eq: () => Promise.resolve(bookingUpdateQuery()) };
        },
      };
      return self;
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

const requireStaffApiSessionMock = vi.fn();
vi.mock('@/lib/requireStaffApiSession', () => ({
  requireStaffApiSession: (...args: unknown[]) => requireStaffApiSessionMock(...args),
}));

const refundTransactionMock = vi.fn();
vi.mock('@/lib/flutterwave', () => ({
  refundTransaction: (...args: unknown[]) => refundTransactionMock(...args),
}));

const { POST } = await import('./route');

const BUSINESS = { id: 'biz-1', name: 'Glow Salon' };
const BOOKING_ID = 'booking-1';

function req(body: unknown) {
  return new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function call(body: unknown = { slug: 'glow-salon' }) {
  return POST(req(body), { params: Promise.resolve({ id: BOOKING_ID }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  rateLimitMock.mockResolvedValue(true);
  requireStaffApiSessionMock.mockResolvedValue({ business: BUSINESS });
  lastUpdatePayload = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/bookings/[id]/refund', () => {
  it('429s when rate-limited, before ever checking auth', async () => {
    rateLimitMock.mockResolvedValueOnce(false);
    const res = await call();
    expect(res.status).toBe(429);
    expect(requireStaffApiSessionMock).not.toHaveBeenCalled();
  });

  it('400s when no slug is given in the body', async () => {
    const res = await call({});
    expect(res.status).toBe(400);
  });

  it('passes through whatever requireStaffApiSession rejects with - owner-only, so a staff (non-owner) request never reaches the booking lookup', async () => {
    requireStaffApiSessionMock.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Only the business owner can do this' }), { status: 403 }),
    });
    const res = await call();
    expect(res.status).toBe(403);
    expect(bookingSelectQuery).not.toHaveBeenCalled();
  });

  it('404s a booking that does not belong to this business - the eq(business_id) scoping is what actually stops a cross-tenant refund, not just the id', async () => {
    bookingSelectQuery.mockResolvedValueOnce({ data: null });
    const res = await call();
    expect(res.status).toBe(404);
    expect(refundTransactionMock).not.toHaveBeenCalled();
  });

  it('400s a booking with no completed payment - nothing to refund', async () => {
    bookingSelectQuery.mockResolvedValueOnce({ data: { id: BOOKING_ID, payment_status: 'pending', payment_reference: null } });
    const res = await call();
    expect(res.status).toBe(400);
    expect(refundTransactionMock).not.toHaveBeenCalled();
  });

  it('400s a paid booking that is somehow missing its payment_reference - defensive, should never happen but must not attempt a refund with no reference to refund', async () => {
    bookingSelectQuery.mockResolvedValueOnce({ data: { id: BOOKING_ID, payment_status: 'paid', payment_reference: null } });
    const res = await call();
    expect(res.status).toBe(400);
    expect(refundTransactionMock).not.toHaveBeenCalled();
  });

  it('502s and alerts critically when Flutterwave itself rejects the refund, without touching the booking row', async () => {
    bookingSelectQuery.mockResolvedValueOnce({
      data: { id: BOOKING_ID, payment_status: 'paid', payment_reference: 'ref_1', amount_paid: 5000, payment_currency: 'NGN' },
    });
    refundTransactionMock.mockResolvedValueOnce({ ok: false, error: 'Transaction already refunded' });

    const res = await call();

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe('Transaction already refunded');
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/bookings/refund',
      expect.any(Error),
      expect.objectContaining({ bookingId: BOOKING_ID, businessId: BUSINESS.id }),
      { critical: true }
    );
    expect(bookingUpdateQuery).not.toHaveBeenCalled();
  });

  it('records the refund on the booking and returns the real amount/currency on success', async () => {
    bookingSelectQuery.mockResolvedValueOnce({
      data: { id: BOOKING_ID, payment_status: 'paid', payment_reference: 'ref_1', amount_paid: 5000, payment_currency: 'NGN' },
    });
    refundTransactionMock.mockResolvedValueOnce({ ok: true });
    bookingUpdateQuery.mockResolvedValueOnce({ error: null });

    const res = await call();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, amount: 5000, currency: 'NGN' });
    expect(lastUpdatePayload).toMatchObject({ refund_status: 'completed', refunded_amount: 5000 });
  });

  it('still reports success to the caller (the refund itself already happened) even when recording it on the booking fails, but logs the miss', async () => {
    bookingSelectQuery.mockResolvedValueOnce({
      data: { id: BOOKING_ID, payment_status: 'paid', payment_reference: 'ref_1', amount_paid: 5000, payment_currency: 'NGN' },
    });
    refundTransactionMock.mockResolvedValueOnce({ ok: true });
    bookingUpdateQuery.mockResolvedValueOnce({ error: { code: 'XX000', message: 'db exploded' } });

    const res = await call();

    expect(res.status).toBe(200);
    expect(logErrorMock).toHaveBeenCalledWith('api/bookings/refund:record', expect.objectContaining({ code: 'XX000' }), expect.anything());
  });

  it('degrades silently (no alert) when the update fails only because the refund columns haven’t been migrated in yet on this database', async () => {
    bookingSelectQuery.mockResolvedValueOnce({
      data: { id: BOOKING_ID, payment_status: 'paid', payment_reference: 'ref_1', amount_paid: 5000, payment_currency: 'NGN' },
    });
    refundTransactionMock.mockResolvedValueOnce({ ok: true });
    bookingUpdateQuery.mockResolvedValueOnce({ error: { code: '42703', message: 'column "refund_status" does not exist' } });

    const res = await call();

    expect(res.status).toBe(200);
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});
