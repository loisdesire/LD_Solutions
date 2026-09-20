import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The payment-gate half of this route - probably the single most
// consequential branch in the app: it decides whether a customer's real
// money actually turned into a confirmed booking, and for a
// foreign-currency payment, whether that money actually got forwarded to
// the business afterward. Never had a test before this. Scoped
// deliberately to the payment logic (payment-required gate, same- and
// foreign-currency verification, the payout-transfer step and its own
// "record every outcome" promise) - the surrounding booking mechanics
// (slot availability, staff assignment, the confirmation email/webhook)
// are mocked out here rather than re-tested, since they're not what this
// pass is about.
//
// Every external collaborator is mocked at the module boundary: the
// Supabase client (hand-rolled chain, same style as
// requireStaffApiSession.test.ts - one vi.fn() per distinct query shape,
// configured with mockResolvedValueOnce per test), and every lib/*
// function this route calls into that already has (or doesn't need) its
// own dedicated tests - lib/flutterwave.ts's functions, lib/assignStaff,
// lib/pushNotify, lib/email, lib/subscription-server. Left real and
// unmocked: lib/apiValidation, lib/timezone, lib/formatMoney,
// lib/emailTemplate, lib/site - pure, already covered elsewhere, and
// using the real versions here also exercises the integration between
// this route and them for free.
const bookingRulesQuery = vi.fn();
const businessQuery = vi.fn();
const serviceQuery = vi.fn();
const bookingsInsertQuery = vi.fn();
const payoutTransfersInsertQuery = vi.fn();

let lastBookingInsertPayload: Record<string, unknown> | null = null;
let payoutTransferInsertPayloads: Record<string, unknown>[] = [];

function chain(table: string, resolver: () => unknown) {
  const self: any = {
    select: () => self,
    eq: () => self,
    insert: (arg: Record<string, unknown>) => {
      if (table === 'bookings') lastBookingInsertPayload = arg;
      if (table === 'payout_transfers') payoutTransferInsertPayloads.push(arg);
      return self;
    },
    maybeSingle: () => Promise.resolve(resolver()),
    single: () => Promise.resolve(resolver()),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject),
  };
  return self;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'booking_rules') return chain(table, bookingRulesQuery);
      if (table === 'businesses') return chain(table, businessQuery);
      if (table === 'services') return chain(table, serviceQuery);
      if (table === 'bookings') return chain(table, bookingsInsertQuery);
      if (table === 'payout_transfers') return chain(table, payoutTransfersInsertQuery);
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

const canAcceptBookingsMock = vi.fn();
vi.mock('@/lib/subscription-server', () => ({
  canAcceptBookings: (...args: unknown[]) => canAcceptBookingsMock(...args),
}));

const verifyTransactionMock = vi.fn();
const getConvertedAmountMock = vi.fn();
const createPayoutTransferMock = vi.fn();
vi.mock('@/lib/flutterwave', () => ({
  verifyTransaction: (...args: unknown[]) => verifyTransactionMock(...args),
  getConvertedAmount: (...args: unknown[]) => getConvertedAmountMock(...args),
  createPayoutTransfer: (...args: unknown[]) => createPayoutTransferMock(...args),
  // Real value, not a mock - the route checks membership against this
  // array directly (`FOREIGN_CURRENCIES.includes(requestedCurrency)`),
  // so it needs to actually be the real list for the "not accepted"
  // branch to mean anything.
  FOREIGN_CURRENCIES: ['USD', 'KES', 'UGX', 'TZS', 'ZAR'],
}));

const pickAvailableStaffIdMock = vi.fn();
vi.mock('@/lib/assignStaff', () => ({
  pickAvailableStaffId: (...args: unknown[]) => pickAvailableStaffIdMock(...args),
}));

const notifyStaffOfNewBookingMock = vi.fn();
vi.mock('@/lib/pushNotify', () => ({
  notifyStaffOfNewBooking: (...args: unknown[]) => notifyStaffOfNewBookingMock(...args),
}));

const sendEmailMock = vi.fn();
vi.mock('@/lib/email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const { POST } = await import('./route');

// isUuid requires real UUID formatting (a version nibble 1-5, a variant
// nibble 8/9/a/b) - an all-same-digit fake string like
// '11111111-1111-1111-1111-111111111111' fails that check silently,
// which every test here learned the hard way (every request came back
// "Invalid booking details" before ever reaching the payment logic).
const BUSINESS_ID = '11111111-1111-4111-8111-111111111111';
const SERVICE_ID = '22222222-2222-4222-8222-222222222222';

function futureIso(daysAhead = 2) {
  return new Date(Date.now() + daysAhead * 86400000).toISOString();
}

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    businessId: BUSINESS_ID,
    serviceId: SERVICE_ID,
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    customerPhone: '+2348012345678',
    startTime: futureIso(),
    ...overrides,
  };
}

function configureBaseline(opts: {
  requirePayment?: boolean;
  price?: number;
  depositPercentage?: number | null;
  subaccountId?: string | null;
  bankCode?: string | null;
  accountNumber?: string | null;
  localCurrency?: string;
  acceptForeign?: boolean;
} = {}) {
  const {
    requirePayment = true,
    price = 5000,
    depositPercentage = null,
    subaccountId = 'sub_123',
    bankCode = '044',
    accountNumber = '0123456789',
    localCurrency = 'NGN',
    acceptForeign = false,
  } = opts;

  bookingRulesQuery.mockResolvedValueOnce({
    data: { webhook_url: null, max_advance_days: 30, require_payment: requirePayment, deposit_percentage: depositPercentage },
    error: null,
  });
  businessQuery.mockResolvedValueOnce({
    data: {
      timezone: 'Africa/Lagos',
      flw_subaccount_id: subaccountId,
      flw_bank_code: bankCode,
      flw_account_number: accountNumber,
      currency: localCurrency,
      accept_foreign_currency: acceptForeign,
      name: 'Glow Salon',
      accent_color: '#C4512D',
      logo_url: null,
      slug: 'glow-salon',
    },
    error: null,
  });
  serviceQuery.mockResolvedValueOnce({ data: { price, name: 'Braids', duration_minutes: 60 }, error: null });
}

function configureBookingInsertSuccess(overrides: Record<string, unknown> = {}) {
  bookingsInsertQuery.mockResolvedValueOnce({ data: { id: 'booking-1', ...overrides }, error: null });
}

beforeEach(() => {
  vi.resetAllMocks();
  rateLimitMock.mockResolvedValue(true);
  canAcceptBookingsMock.mockResolvedValue(true);
  pickAvailableStaffIdMock.mockResolvedValue('staff-1');
  notifyStaffOfNewBookingMock.mockResolvedValue(undefined);
  sendEmailMock.mockResolvedValue(true);
  lastBookingInsertPayload = null;
  payoutTransferInsertPayloads = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/bookings - payment gate', () => {
  it('503s and alerts critically when payment is required but the business has no payout account linked - never silently skips the gate', async () => {
    configureBaseline({ requirePayment: true, subaccountId: null });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123' })));

    expect(res.status).toBe(503);
    expect(verifyTransactionMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/bookings:payment-misconfigured',
      expect.any(Error),
      expect.objectContaining({ businessId: BUSINESS_ID }),
      { critical: true }
    );
  });

  it('402s when payment is required and no payment reference was sent', async () => {
    configureBaseline({ requirePayment: true });

    const res = await POST(req(baseBody()));

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toMatch(/Payment is required/);
    expect(verifyTransactionMock).not.toHaveBeenCalled();
  });

  it('402s and alerts when Flutterwave verification fails outright', async () => {
    configureBaseline({ requirePayment: true, price: 5000 });
    verifyTransactionMock.mockResolvedValueOnce(null);

    const res = await POST(req(baseBody({ paymentReference: 'ref_123' })));

    expect(res.status).toBe(402);
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/bookings:payment-verify-failed',
      expect.any(Error),
      expect.anything(),
      { critical: true }
    );
  });

  it('402s a same-currency payment whose settled amount does not match the service price', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN' });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 3000, currency: 'NGN' });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123' })));

    expect(res.status).toBe(402);
    expect(bookingsInsertQuery).not.toHaveBeenCalled();
  });

  it('402s a same-currency payment that settled in the wrong currency even if the amount happens to match', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN' });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'USD' });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123' })));

    expect(res.status).toBe(402);
  });

  it('books and marks payment_status paid on a verified, matching same-currency payment', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN' });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'NGN' });
    configureBookingInsertSuccess();

    const res = await POST(req(baseBody({ paymentReference: 'ref_123' })));

    expect(res.status).toBe(200);
    expect(lastBookingInsertPayload).toMatchObject({
      payment_status: 'paid',
      amount_paid: 5000,
      payment_currency: null,
    });
  });

  it('accepts a same-currency payment within the small rounding tolerance (Flutterwave fee handling), not just an exact match', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN' });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 4998, currency: 'NGN' });
    configureBookingInsertSuccess();

    const res = await POST(req(baseBody({ paymentReference: 'ref_123' })));

    expect(res.status).toBe(200);
  });

  it('honors deposit_percentage rather than always expecting the full service price', async () => {
    configureBaseline({ requirePayment: true, price: 10000, depositPercentage: 50, localCurrency: 'NGN' });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'NGN' });
    configureBookingInsertSuccess();

    const res = await POST(req(baseBody({ paymentReference: 'ref_123' })));

    expect(res.status).toBe(200);
    expect(lastBookingInsertPayload).toMatchObject({ amount_paid: 5000 });
  });

  it('400s a foreign-currency payment attempt when the business has not opted into foreign currency', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN', acceptForeign: false });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 10, currency: 'USD' });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123', currency: 'USD' })));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/does not accept payment in that currency/);
  });

  it('402s a foreign-currency payment outside the ±5% tolerance of a freshly re-quoted rate', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN', acceptForeign: true });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 4, currency: 'USD' });
    getConvertedAmountMock.mockResolvedValueOnce({ amount: 10, rate: 0.002 });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123', currency: 'USD' })));

    expect(res.status).toBe(402);
    expect(bookingsInsertQuery).not.toHaveBeenCalled();
  });

  it('books a verified foreign-currency payment and forwards the payout to the business’s linked account', async () => {
    configureBaseline({
      requirePayment: true,
      price: 5000,
      localCurrency: 'NGN',
      acceptForeign: true,
      bankCode: '044',
      accountNumber: '0123456789',
    });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 10, currency: 'USD' });
    getConvertedAmountMock.mockResolvedValueOnce({ amount: 10, rate: 0.002 });
    configureBookingInsertSuccess();
    createPayoutTransferMock.mockResolvedValueOnce({ transferId: 'tr_1', status: 'NEW' });
    payoutTransfersInsertQuery.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123', currency: 'USD' })));

    expect(res.status).toBe(200);
    expect(lastBookingInsertPayload).toMatchObject({ payment_status: 'paid', payment_currency: 'USD' });
    expect(createPayoutTransferMock).toHaveBeenCalledWith(
      expect.objectContaining({ accountNumber: '0123456789', bankCode: '044', currency: 'NGN', debitCurrency: 'USD' })
    );
    expect(payoutTransferInsertPayloads[0]).toMatchObject({ status: 'completed', flw_transfer_id: 'tr_1' });
  });

  it('still confirms the booking even when the payout transfer itself fails - the customer already paid and is already confirmed', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN', acceptForeign: true });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 10, currency: 'USD' });
    getConvertedAmountMock.mockResolvedValueOnce({ amount: 10, rate: 0.002 });
    configureBookingInsertSuccess();
    createPayoutTransferMock.mockResolvedValueOnce(null);
    payoutTransfersInsertQuery.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123', currency: 'USD' })));

    expect(res.status).toBe(200);
    expect(payoutTransferInsertPayloads[0]).toMatchObject({ status: 'failed' });
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/bookings:payout-transfer-failed',
      expect.any(Error),
      expect.anything(),
      { critical: true }
    );
  });

  it('alerts separately when the payout_transfers recording insert itself fails, even though the transfer succeeded - a successful transfer with no row is just as unreconcilable as a failed one nobody heard about', async () => {
    configureBaseline({ requirePayment: true, price: 5000, localCurrency: 'NGN', acceptForeign: true });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 10, currency: 'USD' });
    getConvertedAmountMock.mockResolvedValueOnce({ amount: 10, rate: 0.002 });
    configureBookingInsertSuccess();
    createPayoutTransferMock.mockResolvedValueOnce({ transferId: 'tr_1', status: 'NEW' });
    payoutTransfersInsertQuery.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    const res = await POST(req(baseBody({ paymentReference: 'ref_123', currency: 'USD' })));

    expect(res.status).toBe(200);
    expect(logErrorMock).toHaveBeenCalledWith(
      'api/bookings:payout-transfer-record-failed',
      expect.anything(),
      expect.anything(),
      { critical: true }
    );
  });

  it('skips payment verification entirely when the business has not turned require_payment on', async () => {
    configureBaseline({ requirePayment: false, price: 5000 });
    configureBookingInsertSuccess();

    const res = await POST(req(baseBody()));

    expect(res.status).toBe(200);
    expect(verifyTransactionMock).not.toHaveBeenCalled();
    expect(lastBookingInsertPayload).toMatchObject({ payment_status: null });
  });

  it('skips payment verification when require_payment is on but the service itself has no price - an unpriced service can’t require payment', async () => {
    configureBaseline({ requirePayment: true, price: null as unknown as number });
    configureBookingInsertSuccess();

    const res = await POST(req(baseBody()));

    expect(res.status).toBe(200);
    expect(verifyTransactionMock).not.toHaveBeenCalled();
  });
});
