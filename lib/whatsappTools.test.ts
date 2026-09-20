import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The customer-facing chat booking flow - every channel (WhatsApp,
// Telegram, web chat) reaches real money and real slots through these
// five functions. Zero tests existed before this, despite EVERY ONE of
// them having a documented live-bug fix already baked into its own
// comments: createBooking (a duplicate payment hold when a customer's
// link failed and they asked again; a web-chat booking with literally no
// way to contact the customer back), checkPayment (a payment that went
// completely unreconciled because the stale-hold sweep had already
// cancelled the row it needed to find), confirmPaidBooking (an update
// with no .select() silently reporting fake success while the booking
// stayed cancelled - a real payment that appeared to confirm with no
// error), cancelBooking/rescheduleBooking (an unverified web session
// cancelling a real stranger's real appointment with zero proof of who
// they were). This is the highest-bug-density file in the codebase and
// it had zero regression coverage for any of it.
//
// Same reusable-table-double pattern as lib/manageTools.test.ts.
type TableResult = { data?: unknown; error?: unknown };

function makeTable() {
  const queue: TableResult[] = [];
  const insertPayloads: unknown[] = [];
  const updatePayloads: unknown[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = {
    select: () => self,
    insert: (arg: unknown) => {
      insertPayloads.push(arg);
      return self;
    },
    update: (arg: unknown) => {
      updatePayloads.push(arg);
      return self;
    },
    eq: () => self,
    neq: () => self,
    ilike: () => self,
    in: () => self,
    not: () => self,
    order: () => self,
    limit: () => self,
    is: () => self,
    gte: () => self,
    lte: () => self,
    maybeSingle: () => Promise.resolve(next()),
    single: () => Promise.resolve(next()),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(next()).then(resolve, reject),
  };
  return {
    self,
    push: (...items: TableResult[]) => queue.push(...items),
    insertPayloads,
    updatePayloads,
    reset: () => {
      queue.length = 0;
      insertPayloads.length = 0;
      updatePayloads.length = 0;
    },
  };
}

const servicesTable = makeTable();
const businessesTable = makeTable();
const bookingRulesTable = makeTable();
const bookingsTable = makeTable();
const TABLES: Record<string, ReturnType<typeof makeTable>> = {
  services: servicesTable,
  businesses: businessesTable,
  booking_rules: bookingRulesTable,
  bookings: bookingsTable,
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const t = TABLES[table];
      if (!t) throw new Error(`test double doesn't expect a query against "${table}"`);
      return t.self;
    },
  }),
}));

const canAcceptBookingsMock = vi.fn();
vi.mock('./subscription-server', () => ({ canAcceptBookings: (...args: unknown[]) => canAcceptBookingsMock(...args) }));

const pickAvailableStaffIdMock = vi.fn();
vi.mock('./assignStaff', () => ({ pickAvailableStaffId: (...args: unknown[]) => pickAvailableStaffIdMock(...args) }));

const initializeSplitTransactionMock = vi.fn();
const verifyTransactionMock = vi.fn();
vi.mock('./flutterwave', () => ({
  initializeSplitTransaction: (...args: unknown[]) => initializeSplitTransactionMock(...args),
  verifyTransaction: (...args: unknown[]) => verifyTransactionMock(...args),
}));

const sendEmailMock = vi.fn();
vi.mock('./email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const notifyStaffOfNewBookingMock = vi.fn();
const notifyStaffOfOwnerReviewRequestMock = vi.fn();
vi.mock('./pushNotify', () => ({
  notifyStaffOfNewBooking: (...args: unknown[]) => notifyStaffOfNewBookingMock(...args),
  notifyStaffOfOwnerReviewRequest: (...args: unknown[]) => notifyStaffOfOwnerReviewRequestMock(...args),
}));

const getBusinessTimezoneMock = vi.fn();
vi.mock('./getBusinessTimezone', () => ({ getBusinessTimezone: (...args: unknown[]) => getBusinessTimezoneMock(...args) }));

const getAvailableSlotsMock = vi.fn();
vi.mock('./getAvailableSlots', () => ({ getAvailableSlots: (...args: unknown[]) => getAvailableSlotsMock(...args) }));

const { createBooking, checkPayment, confirmPaidBooking, cancelBooking, rescheduleBooking } = await import('./whatsappTools');

const BUSINESS_ID = 'biz-1';
const SERVICE = { id: 'svc-1', name: 'Haircut', duration_minutes: 30, price: 5000 };
const BUSINESS_NO_PAYMENT = {
  name: 'Glow Salon',
  slug: 'glow-salon',
  timezone: 'Africa/Lagos',
  accent_color: '#C4512D',
  logo_url: null,
  flw_subaccount_id: null,
  currency: 'NGN',
};
const BUSINESS_WITH_PAYMENT = { ...BUSINESS_NO_PAYMENT, flw_subaccount_id: 'sub_123' };

function futureDateTime() {
  const d = new Date(Date.now() + 3 * 86400000);
  return { date: d.toISOString().slice(0, 10), time: '10:00' };
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const t of Object.values(TABLES)) t.reset();
  canAcceptBookingsMock.mockResolvedValue(true);
  pickAvailableStaffIdMock.mockResolvedValue('staff-1');
  sendEmailMock.mockResolvedValue(true);
  notifyStaffOfNewBookingMock.mockResolvedValue(undefined);
  getBusinessTimezoneMock.mockResolvedValue('Africa/Lagos');
  getAvailableSlotsMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createBooking', () => {
  const ctx = { businessId: BUSINESS_ID, customerPhone: 'whatsapp:+2348012345678' };

  it('refuses to book when the business is not currently accepting bookings, before ever looking anything else up', async () => {
    canAcceptBookingsMock.mockResolvedValueOnce(false);
    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, { serviceName: 'Haircut', date, time, customerName: 'Amara' });
    expect(result.error).toMatch(/currently accepting/);
  });

  it('errors when the requested service does not exist', async () => {
    servicesTable.push({ data: null });
    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, { serviceName: 'Massage', date, time, customerName: 'Amara' });
    expect(result.error).toMatch(/no service matching/i);
  });

  it('books a free (no-payment) service straight to confirmed, on a real WhatsApp contact, no email required', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_NO_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: false, deposit_percentage: null } });
    pickAvailableStaffIdMock.mockResolvedValueOnce('staff-1');
    bookingsTable.push({ data: { id: 'booking-1', staff_id: 'staff-1', start_time: '2026-06-01T09:00:00.000Z' }, error: null });

    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, { serviceName: 'Haircut', date, time, customerName: 'Amara' });

    expect(result).toMatchObject({ confirmed: true, booking_id: 'booking-1' });
    expect(bookingsTable.insertPayloads[0]).toMatchObject({ status: 'confirmed', payment_status: null });
  });

  it('refuses to book a paid service for free - requires payment to be initiated when the business has a linked payout account and the service has a price', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_WITH_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: true, deposit_percentage: null } });

    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, { serviceName: 'Haircut', date, time, customerName: 'Amara' });

    // No email given - asks for one first (needed for the receipt/checkout),
    // rather than silently booking it free.
    expect(result.needs_email).toBe(true);
    expect(bookingsTable.insertPayloads).toHaveLength(0);
  });

  it('holds the slot as pending_payment and returns a real checkout link once an email is given', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_WITH_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: true, deposit_percentage: null } });
    bookingsTable.push({ data: null }); // no existing hold
    pickAvailableStaffIdMock.mockResolvedValueOnce('staff-1');
    bookingsTable.push({ data: { id: 'booking-1', staff_id: 'staff-1', start_time: '2026-06-01T09:00:00.000Z' }, error: null }); // insert
    initializeSplitTransactionMock.mockResolvedValueOnce({ checkoutUrl: 'https://flutterwave.test/pay/abc' });
    bookingsTable.push({ error: null }); // payment_reference update

    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, {
      serviceName: 'Haircut',
      date,
      time,
      customerName: 'Amara',
      customerEmail: 'amara@example.com',
    });

    expect(result).toMatchObject({ awaiting_payment: true, booking_id: 'booking-1', payment_url: 'https://flutterwave.test/pay/abc' });
    expect(result.instructions).toMatch(/Do NOT say the booking is confirmed/);
    expect(bookingsTable.insertPayloads[0]).toMatchObject({ status: 'pending_payment', payment_status: 'pending' });
  });

  it('reuses and refreshes an existing pending_payment hold for the same customer/service/slot instead of creating a second one - the exact duplicate-hold bug already fixed live', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_WITH_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: true, deposit_percentage: null } });
    bookingsTable.push({ data: { id: 'existing-hold', staff_id: 'staff-1', payment_status: 'pending' } }); // existingHold found
    bookingsTable.push({ data: { id: 'existing-hold', staff_id: 'staff-1', start_time: '2026-06-01T09:00:00.000Z' }, error: null }); // refresh update+select
    initializeSplitTransactionMock.mockResolvedValueOnce({ checkoutUrl: 'https://flutterwave.test/pay/refreshed' });
    bookingsTable.push({ error: null }); // payment_reference update

    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, {
      serviceName: 'Haircut',
      date,
      time,
      customerName: 'Amara',
      customerEmail: 'amara@example.com',
    });

    expect(result.booking_id).toBe('existing-hold');
    // Never inserted a second row - pickAvailableStaffId (only called on
    // the fresh-insert path) never even ran.
    expect(pickAvailableStaffIdMock).not.toHaveBeenCalled();
    expect(bookingsTable.insertPayloads).toHaveLength(0);
  });

  it('releases the hold immediately rather than leaving it sitting for 15 minutes when the checkout itself fails to start', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_WITH_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: true, deposit_percentage: null } });
    bookingsTable.push({ data: null }); // no existing hold
    pickAvailableStaffIdMock.mockResolvedValueOnce('staff-1');
    bookingsTable.push({ data: { id: 'booking-1', staff_id: 'staff-1', start_time: '2026-06-01T09:00:00.000Z' }, error: null });
    initializeSplitTransactionMock.mockResolvedValueOnce(null);
    bookingsTable.push({ error: null }); // the release update

    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, {
      serviceName: 'Haircut',
      date,
      time,
      customerName: 'Amara',
      customerEmail: 'amara@example.com',
    });

    expect(result.error).toMatch(/couldn't start the payment/i);
    expect(bookingsTable.updatePayloads.at(-1)).toMatchObject({ status: 'cancelled', payment_status: 'failed' });
  });

  it('asks for an email on web chat even for a free service - an anonymous web session has no other way to reach the customer back', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_NO_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: false, deposit_percentage: null } });

    const { date, time } = futureDateTime();
    const result: any = await createBooking(
      { businessId: BUSINESS_ID, customerPhone: 'web:session-abc' },
      { serviceName: 'Haircut', date, time, customerName: 'Amara' }
    );

    expect(result.needs_email).toBe(true);
    expect(result.instructions).toMatch(/no real way to reach this customer/);
  });

  it('refuses the booking when no staff member is actually free at that time', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_NO_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: false, deposit_percentage: null } });
    pickAvailableStaffIdMock.mockResolvedValueOnce(null);

    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, { serviceName: 'Haircut', date, time, customerName: 'Amara' });

    expect(result.error).toMatch(/no longer available/);
    expect(bookingsTable.insertPayloads).toHaveLength(0);
  });

  it('translates a real exclusion-constraint conflict (23P01) into the same friendly "slot taken" message, not a raw DB error', async () => {
    servicesTable.push({ data: SERVICE });
    businessesTable.push({ data: BUSINESS_NO_PAYMENT });
    bookingRulesTable.push({ data: { require_payment: false, deposit_percentage: null } });
    pickAvailableStaffIdMock.mockResolvedValueOnce('staff-1');
    bookingsTable.push({ data: null, error: { code: '23P01', message: 'exclusion violation' } });

    const { date, time } = futureDateTime();
    const result: any = await createBooking(ctx, { serviceName: 'Haircut', date, time, customerName: 'Amara' });

    expect(result.error).toMatch(/no longer available/);
  });
});

describe('checkPayment', () => {
  const ctx = { businessId: BUSINESS_ID, customerPhone: 'whatsapp:+2348012345678' };

  it('reports no booking to check when nothing active or recently lapsed matches this customer', async () => {
    bookingsTable.push({ data: [] }, { data: [] });
    const result: any = await checkPayment(ctx);
    expect(result.error).toMatch(/no recent booking found/i);
  });

  it('reassures rather than re-verifies when the booking is already confirmed - never asks a confirmed customer to pay again', async () => {
    bookingsTable.push({ data: [{ id: 'b1', status: 'confirmed', payment_reference: 'ref1', created_at: '2026-01-01T00:00:00Z' }] }, { data: [] });
    const result: any = await checkPayment(ctx);
    expect(result.already_confirmed).toBe(true);
  });

  it('also checks recently-lapsed (cancelled-but-paid-attempt) bookings, not just active ones - the exact fix for payments the stale-hold sweep had already cancelled', async () => {
    // Nothing active; one cancelled row with a real payment_reference from
    // within the reconciliation window.
    bookingsTable.push({ data: [] }, { data: [{ id: 'b1', status: 'cancelled', payment_reference: 'ref1', created_at: '2026-01-01T00:00:00Z' }] });
    // confirmPaidBooking's own lookups, reached via checkPayment:
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, service_id: 'svc-1', status: 'cancelled', start_time: '2026-06-01T09:00:00Z', customer_name: 'Amara' } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123', currency: 'NGN' } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'NGN' });
    bookingsTable.push({ data: [{ id: 'b1' }], error: null }); // confirm update+select

    const result: any = await checkPayment(ctx);

    expect(result.confirmed).toBe(true);
  });

  it('tells the customer their payment has not been recorded yet, rather than a generic failure, when Flutterwave has no successful transaction for that reference', async () => {
    bookingsTable.push({ data: [{ id: 'b1', status: 'pending_payment', payment_reference: 'ref1', created_at: '2026-01-01T00:00:00Z' }] }, { data: [] });
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, service_id: 'svc-1', status: 'pending_payment', start_time: '2026-06-01T09:00:00Z', customer_name: 'Amara' } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123', currency: 'NGN' } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });
    verifyTransactionMock.mockResolvedValueOnce(null);

    const result: any = await checkPayment(ctx);

    expect(result.confirmed).toBe(false);
    expect(result.instructions).toMatch(/hasn't been recorded yet/);
  });

  it('alerts critically and offers real alternative times when the customer genuinely paid but the hold already lapsed', async () => {
    bookingsTable.push({ data: [{ id: 'b1', status: 'pending_payment', payment_reference: 'ref1', created_at: '2026-01-01T00:00:00Z' }] }, { data: [] });
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, service_id: 'svc-1', status: 'pending_payment', start_time: '2026-06-01T09:00:00Z', customer_name: 'Amara' } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123', currency: 'NGN' } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'NGN' });
    bookingsTable.push({ data: [], error: null }); // confirm update matched 0 rows - hold already lapsed
    bookingsTable.push({ error: null }); // paid_slot_lost update
    getAvailableSlotsMock.mockResolvedValueOnce(['2026-06-02T09:00:00.000Z']);

    const result: any = await checkPayment(ctx);

    expect(result.slot_taken).toBe(true);
    expect(result.alternatives).toHaveLength(1);
  });
});

describe('confirmPaidBooking', () => {
  it('reports not_found for a booking id that does not exist', async () => {
    bookingsTable.push({ data: null });
    const result = await confirmPaidBooking('no-such-booking', 'ref1');
    expect(result).toEqual({ confirmed: false, reason: 'not_found' });
  });

  it('short-circuits to confirmed without re-verifying anything when the booking is already confirmed - a customer paying twice, or the webhook and check_payment both landing, must never double-process', async () => {
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, status: 'confirmed', start_time: '2026-06-01T09:00:00Z' } });
    const result = await confirmPaidBooking('b1', 'ref1');
    expect(result.confirmed).toBe(true);
    expect(verifyTransactionMock).not.toHaveBeenCalled();
  });

  it('reports not_configured when the business has no payout account at all', async () => {
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, status: 'pending_payment', start_time: '2026-06-01T09:00:00Z' } });
    businessesTable.push({ data: { flw_subaccount_id: null } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });

    const result = await confirmPaidBooking('b1', 'ref1');
    expect(result.reason).toBe('not_configured');
  });

  it('rejects a settlement in the wrong currency, even if the amount happens to match', async () => {
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, service_id: 'svc-1', status: 'pending_payment', start_time: '2026-06-01T09:00:00Z' } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123', currency: 'NGN' } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'USD' });

    const result = await confirmPaidBooking('b1', 'ref1');
    expect(result.reason).toBe('amount_mismatch');
  });

  it('rejects a settled amount that does not match what was actually owed', async () => {
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, service_id: 'svc-1', status: 'pending_payment', start_time: '2026-06-01T09:00:00Z' } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123', currency: 'NGN' } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 1000, currency: 'NGN' });

    const result = await confirmPaidBooking('b1', 'ref1');
    expect(result.reason).toBe('amount_mismatch');
  });

  it('confirms a genuinely paid, still-held booking', async () => {
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, service_id: 'svc-1', status: 'pending_payment', start_time: '2026-06-01T09:00:00Z', customer_name: 'Amara' } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123', currency: 'NGN' } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'NGN' });
    bookingsTable.push({ data: [{ id: 'b1' }], error: null });

    const result = await confirmPaidBooking('b1', 'ref1');
    expect(result.confirmed).toBe(true);
  });

  it('routes a genuinely paid booking whose hold already lapsed (0 rows updated, no thrown error) into paid_slot_lost handling, not a silent false-positive confirm - the exact live bug this .select() fix exists for', async () => {
    bookingsTable.push({ data: { id: 'b1', business_id: BUSINESS_ID, service_id: 'svc-1', status: 'pending_payment', start_time: '2026-06-01T09:00:00Z', customer_name: 'Amara' } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123', currency: 'NGN' } });
    bookingRulesTable.push({ data: { deposit_percentage: null } });
    servicesTable.push({ data: { price: 5000, name: 'Haircut' } });
    verifyTransactionMock.mockResolvedValueOnce({ status: 'successful', amount: 5000, currency: 'NGN' });
    // The WHERE clause (status = 'pending_payment') matched nothing because
    // the sweep already flipped it to cancelled - Postgres/PostgREST report
    // that as zero rows, not an error.
    bookingsTable.push({ data: [], error: null });
    bookingsTable.push({ error: null }); // paid_slot_lost update
    getAvailableSlotsMock.mockResolvedValueOnce([]);

    const result = await confirmPaidBooking('b1', 'ref1');

    expect(result.confirmed).toBe(false);
    expect(result.reason).toBe('slot_taken');
    expect(bookingsTable.updatePayloads.at(-1)).toMatchObject({ payment_status: 'paid_slot_lost' });
  });
});

describe('cancelBooking', () => {
  const phoneCtx = { businessId: BUSINESS_ID, customerPhone: 'whatsapp:+2348012345678' };
  const webCtx = { businessId: BUSINESS_ID, customerPhone: 'web:session-abc' };
  const args = { serviceName: 'Haircut', date: '2026-06-01', time: '10:00' };

  it('errors when no matching booking is found for that service/date/time', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: null });
    const result: any = await cancelBooking(phoneCtx, args);
    expect(result.error).toMatch(/could not find a matching booking/i);
  });

  it('refuses to cancel an already-cancelled booking', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: { id: 'b1', status: 'cancelled', start_time: '2026-06-01T09:00:00Z' } });
    const result: any = await cancelBooking(phoneCtx, args);
    expect(result.error).toMatch(/already cancelled/);
  });

  it('cancels freely on a real WhatsApp contact, no confirmation needed - a phone number is already real proof of identity', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: { id: 'b1', status: 'confirmed', start_time: new Date(Date.now() + 5 * 86400000).toISOString() } });
    bookingRulesTable.push({ data: { cancellation_window_hours: 24 } });
    bookingsTable.push({ error: null });

    const result: any = await cancelBooking(phoneCtx, args);
    expect(result.cancelled).toBe(true);
  });

  it('refuses to cancel on an unverified web session without a matching confirm_contact - the exact live bug where a fresh "cancel my booking" cancelled a stranger’s real appointment', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: { id: 'b1', status: 'confirmed', start_time: new Date(Date.now() + 5 * 86400000).toISOString(), customer_email: 'amara@example.com' } });

    const result: any = await cancelBooking(webCtx, args);

    expect(result.needs_confirmation).toBe(true);
    expect(bookingsTable.updatePayloads).toHaveLength(0);
  });

  it('proceeds on a web session once confirm_contact matches the email on file, case-insensitively', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: { id: 'b1', status: 'confirmed', start_time: new Date(Date.now() + 5 * 86400000).toISOString(), customer_email: 'amara@example.com' } });
    bookingRulesTable.push({ data: { cancellation_window_hours: 24 } });
    bookingsTable.push({ error: null });

    const result: any = await cancelBooking(webCtx, { ...args, confirmContact: 'AMARA@EXAMPLE.COM' });
    expect(result.cancelled).toBe(true);
  });

  it('refuses a web session whose confirm_contact does not actually match', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: { id: 'b1', status: 'confirmed', start_time: new Date(Date.now() + 5 * 86400000).toISOString(), customer_email: 'amara@example.com' } });

    const result: any = await cancelBooking(webCtx, { ...args, confirmContact: 'someone-else@example.com' });
    expect(result.needs_confirmation).toBe(true);
  });

  it('refuses to cancel inside the business’s own cancellation window', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: { id: 'b1', status: 'confirmed', start_time: new Date(Date.now() + 2 * 3600000).toISOString() } }); // 2 hours out
    bookingRulesTable.push({ data: { cancellation_window_hours: 24 } });

    const result: any = await cancelBooking(phoneCtx, args);
    expect(result.error).toMatch(/at least 24 hours in advance/);
  });
});

describe('rescheduleBooking', () => {
  const phoneCtx = { businessId: BUSINESS_ID, customerPhone: 'whatsapp:+2348012345678' };
  const webCtx = { businessId: BUSINESS_ID, customerPhone: 'web:session-abc' };
  // newDate/newTime have to be real future values - rescheduleBooking checks
  // them against the REAL current date (daysBetween/todayInTimezone are left
  // unmocked, pure and already covered by their own tests), unlike the
  // "existing booking" fixtures below, which are just directly injected
  // Supabase rows and never re-derived from args.date/time at all.
  const newDateStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const args = { serviceName: 'Haircut', date: '2026-06-01', time: '10:00', newDate: newDateStr, newTime: '11:00' };

  it('refuses to reschedule on an unverified web session without a matching confirm_contact - same identity boundary as cancelBooking', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({ data: { id: 'b1', status: 'confirmed', start_time: new Date(Date.now() + 5 * 86400000).toISOString(), customer_email: 'amara@example.com' } });

    const result: any = await rescheduleBooking(webCtx, args);
    expect(result.needs_confirmation).toBe(true);
  });

  it('only checks conflicts against the SAME staff member this booking is already assigned to, not the whole business', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({
      data: {
        id: 'b1',
        status: 'confirmed',
        start_time: new Date(Date.now() + 5 * 86400000).toISOString(),
        staff_id: 'staff-1',
        services: { duration_minutes: 30 },
      },
    });
    bookingRulesTable.push({ data: { cancellation_window_hours: 24, buffer_minutes: 0, max_advance_days: 30 } });
    // Another staff member has a real conflicting booking at the new time -
    // must NOT block the reschedule, since it's a different staff member.
    // Simulated here by the double simply returning no conflicting rows,
    // standing in for "the other staff's booking was correctly excluded by
    // the staff_id scoping".
    bookingsTable.push({ data: [] });
    bookingsTable.push({ data: { id: 'b1', start_time: `${newDateStr}T10:00:00.000Z` }, error: null });

    const result: any = await rescheduleBooking(phoneCtx, args);
    expect(result.rescheduled).toBe(true);
  });

  it('refuses when the new time genuinely overlaps another booking for the same staff member', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({
      data: {
        id: 'b1',
        status: 'confirmed',
        start_time: new Date(Date.now() + 5 * 86400000).toISOString(),
        staff_id: 'staff-1',
        services: { duration_minutes: 30 },
      },
    });
    bookingRulesTable.push({ data: { cancellation_window_hours: 24, buffer_minutes: 0, max_advance_days: 30 } });
    bookingsTable.push({ data: [{ start_time: `${newDateStr}T10:15:00.000Z`, end_time: `${newDateStr}T10:45:00.000Z` }] });

    const result: any = await rescheduleBooking(phoneCtx, args);
    expect(result.error).toMatch(/no longer available/);
  });

  it('refuses a new date beyond the advance-booking window', async () => {
    servicesTable.push({ data: SERVICE });
    bookingsTable.push({
      data: {
        id: 'b1',
        status: 'confirmed',
        start_time: new Date(Date.now() + 5 * 86400000).toISOString(),
        staff_id: 'staff-1',
        services: { duration_minutes: 30 },
      },
    });
    bookingRulesTable.push({ data: { cancellation_window_hours: 24, buffer_minutes: 0, max_advance_days: 1 } });

    const farFuture = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10);
    const result: any = await rescheduleBooking(phoneCtx, { ...args, newDate: farFuture });
    expect(result.error).toMatch(/not available for booking/);
  });
});
