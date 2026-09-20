import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// "Manage your business by chat" - the write-capable half of the owner
// assistant. 1000+ lines, zero tests before this, despite being exactly
// where this session already found and fixed two real duplicate-write
// bugs (applyCreateService, applyCreateReminder) and a rate-limit-based
// dedupe guard (applyEmailCustomer) earlier this session - all three
// previously verified by hand, never by a regression test. Scoped to
// every exported propose_*/apply_* pair; the shared validators
// (cleanName, cleanPrice, etc.) are exercised indirectly through them
// rather than tested in isolation, since they're private and their real
// job is only visible through the tools that use them.
//
// One reusable table double per table name, not a bespoke mock per test -
// this file touches six different tables across its 14 functions, several
// of them more than once per call with different intents (select, then a
// separate duplicate-check select, then insert). Each table queues
// {data,error,count} results consumed in call order via .mockResolvedValueOnce-
// equivalent semantics (a plain array shift), which requires knowing the
// real call order per function - traced directly from the source, not
// guessed.
type TableResult = { data?: unknown; error?: unknown; count?: number };

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
    delete: () => self,
    eq: () => self,
    ilike: () => self,
    order: () => self,
    limit: () => self,
    is: () => self,
    gte: () => self,
    lte: () => self,
    neq: () => self,
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
const availabilityTable = makeTable();
const bookingsTable = makeTable();
const ownerRemindersTable = makeTable();
const TABLES: Record<string, ReturnType<typeof makeTable>> = {
  services: servicesTable,
  businesses: businessesTable,
  booking_rules: bookingRulesTable,
  availability: availabilityTable,
  bookings: bookingsTable,
  owner_reminders: ownerRemindersTable,
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

const getBusinessTimezoneMock = vi.fn();
vi.mock('./getBusinessTimezone', () => ({ getBusinessTimezone: (...args: unknown[]) => getBusinessTimezoneMock(...args) }));

const rateLimitMock = vi.fn();
vi.mock('./rateLimit', () => ({ rateLimit: (...args: unknown[]) => rateLimitMock(...args) }));

const sendEmailMock = vi.fn();
vi.mock('./email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const {
  proposeCreateService,
  applyCreateService,
  proposeUpdateService,
  applyUpdateService,
  proposeToggleSetting,
  applyToggleSetting,
  proposeUpdateProfile,
  applyUpdateProfile,
  proposeUpdateBookingRules,
  applyUpdateBookingRules,
  proposeUpdateHours,
  applyUpdateHours,
  proposeCreateReminder,
  applyCreateReminder,
  proposeEmailCustomer,
  applyEmailCustomer,
} = await import('./manageTools');

const BUSINESS_ID = 'biz-1';
const OWN_SUPABASE_URL = 'https://realproject.supabase.co';
const REAL_IMAGE_URL = `${OWN_SUPABASE_URL}/storage/v1/object/public/business-media/${BUSINESS_ID}/photo.jpg`;

beforeEach(() => {
  vi.resetAllMocks();
  for (const t of Object.values(TABLES)) t.reset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = OWN_SUPABASE_URL;
  getBusinessTimezoneMock.mockResolvedValue('Africa/Lagos');
  rateLimitMock.mockResolvedValue(true);
  sendEmailMock.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('propose/apply_create_service', () => {
  it('rejects with no services given at all', async () => {
    const result = await proposeCreateService(BUSINESS_ID, {});
    expect(result).toEqual({ error: expect.stringMatching(/no services given/i) });
  });

  it('proposes a real service, flagging it as new (not a pre-existing duplicate)', async () => {
    servicesTable.push({ data: null }); // duplicate-check for propose
    const result: any = await proposeCreateService(BUSINESS_ID, {
      services: [{ name: 'haircut', durationMinutes: 30, price: 5000 }],
    });
    expect(result.services[0]).toMatchObject({ already_exists: false, name: 'Haircut', duration_minutes: 30 });
  });

  it('flags a proposed service whose name already exists, with a note steering away from an accidental duplicate', async () => {
    servicesTable.push({ data: { id: 'svc-existing' } });
    const result: any = await proposeCreateService(BUSINESS_ID, {
      services: [{ name: 'Haircut', durationMinutes: 30, price: 5000 }],
    });
    expect(result.services[0].already_exists).toBe(true);
    expect(result.services[0].note).toMatch(/already exists/);
  });

  it('handles a batch of several services in one call, not just one - the real fix for the "shows the same list again" bug', async () => {
    servicesTable.push({ data: null }, { data: null }, { data: null });
    const result: any = await proposeCreateService(BUSINESS_ID, {
      services: [
        { name: 'Haircut', durationMinutes: 30, price: 5000 },
        { name: 'Beard trim', durationMinutes: 15, price: 2000 },
        { name: 'Wash', durationMinutes: 10 },
      ],
    });
    expect(result.services).toHaveLength(3);
    expect(result.services[2].price).toBe('Ask for pricing (no price set)');
  });

  it('creates a real new service and never touches the database twice for one apply call', async () => {
    servicesTable.push({ data: null }); // no existing duplicate
    servicesTable.push({ data: { id: 'svc-1', name: 'Haircut' }, error: null }); // insert result

    const result: any = await applyCreateService(BUSINESS_ID, {
      services: [{ name: 'Haircut', durationMinutes: 30, price: 5000 }],
    });

    expect(result.services[0]).toMatchObject({ created: true, service_id: 'svc-1' });
    expect(servicesTable.insertPayloads).toHaveLength(1);
  });

  it('a repeat apply_create_service call for the same service is a no-op, not a second row - the exact bug already confirmed live and fixed this session', async () => {
    servicesTable.push({ data: { id: 'svc-existing', name: 'Haircut' } }); // duplicate check finds it

    const result: any = await applyCreateService(BUSINESS_ID, {
      services: [{ name: 'Haircut', durationMinutes: 30, price: 5000 }],
    });

    expect(result.services[0]).toMatchObject({ created: false, already_existed: true, service_id: 'svc-existing' });
    expect(servicesTable.insertPayloads).toHaveLength(0);
  });

  it('the duplicate check is exact-match, not the fuzzy search - "Haircut" and "Haircut & Beard" must never be treated as the same service', async () => {
    // The duplicate-check query itself is exact (.ilike(name) with the
    // clean name, not a %wrapped% search) - simulated here by the double
    // simply returning no match for a differently-named service.
    servicesTable.push({ data: null });
    servicesTable.push({ data: { id: 'svc-2', name: 'Haircut & Beard' }, error: null });

    const result: any = await applyCreateService(BUSINESS_ID, {
      services: [{ name: 'Haircut & Beard', durationMinutes: 45, price: 7000 }],
    });

    expect(result.services[0].created).toBe(true);
  });

  it('rejects a service image URL that is not a real upload from this business’s own chat', async () => {
    const result: any = await proposeCreateService(BUSINESS_ID, {
      services: [{ name: 'Haircut', durationMinutes: 30, imageUrl: 'https://evil.example.com/x.jpg' }],
    });
    expect(result.services[0].error).toMatch(/doesn't look like one uploaded/);
  });

  it('accepts a real uploaded image URL for this exact business', async () => {
    servicesTable.push({ data: null });
    const result: any = await proposeCreateService(BUSINESS_ID, {
      services: [{ name: 'Haircut', durationMinutes: 30, imageUrl: REAL_IMAGE_URL }],
    });
    expect(result.services[0].has_image).toBe(true);
  });

  it('rejects an unreasonable duration or price rather than silently clamping it', async () => {
    const badDuration: any = await proposeCreateService(BUSINESS_ID, { services: [{ name: 'X', durationMinutes: 9999 }] });
    expect(badDuration.services[0].error).toMatch(/duration/i);

    const badPrice: any = await proposeCreateService(BUSINESS_ID, { services: [{ name: 'X', durationMinutes: 30, price: -50 }] });
    expect(badPrice.services[0].error).toMatch(/price/i);
  });

  it('degrades to the pre-migration columns and says so plainly, rather than losing the service entirely, when description/image/category columns don’t exist yet', async () => {
    servicesTable.push({ data: null }); // no duplicate
    servicesTable.push({ data: null, error: { code: '42703' } }); // full insert fails: missing column
    servicesTable.push({ data: { id: 'svc-1', name: 'Haircut' }, error: null }); // fallback insert succeeds

    const result: any = await applyCreateService(BUSINESS_ID, {
      services: [{ name: 'Haircut', durationMinutes: 30, description: 'Nice cut' }],
    });

    expect(result.services[0]).toMatchObject({ created: true, service_id: 'svc-1' });
    expect(result.services[0].note).toMatch(/pending database update/);
  });
});

describe('propose/apply_update_service', () => {
  it('asks which service when the search matches nothing', async () => {
    servicesTable.push({ data: [] });
    const result: any = await proposeUpdateService(BUSINESS_ID, { serviceName: 'Massage', changes: { price: 6000 } });
    expect(result.error).toMatch(/no service matching/i);
  });

  it('asks for disambiguation when the search matches more than one service', async () => {
    servicesTable.push({ data: [{ id: '1', name: 'Massage 30min', active: true, price: 5000 }, { id: '2', name: 'Massage 60min', active: true, price: 9000 }] });
    const result: any = await proposeUpdateService(BUSINESS_ID, { serviceName: 'Massage', changes: { price: 6000 } });
    expect(result.needs_disambiguation).toBe(true);
    expect(result.matches).toHaveLength(2);
  });

  it('proposes nothing when the requested change matches the current value exactly', async () => {
    servicesTable.push({ data: [{ id: '1', name: 'Haircut', duration_minutes: 30, price: 5000, active: true }] });
    const result: any = await proposeUpdateService(BUSINESS_ID, { serviceName: 'Haircut', changes: { durationMinutes: 30 } });
    expect(result.error).toMatch(/no real changes/i);
  });

  it('applies an update only after re-resolving the service, refusing to apply against an ambiguous match', async () => {
    servicesTable.push({ data: [{ id: '1', name: 'Massage 30min', active: true }, { id: '2', name: 'Massage 60min', active: true }] });
    const result: any = await applyUpdateService(BUSINESS_ID, { serviceName: 'Massage', changes: { price: 6000 } });
    expect(result.error).toMatch(/more than one service/i);
    expect(servicesTable.updatePayloads).toHaveLength(0);
  });

  it('updates a single unambiguous match', async () => {
    servicesTable.push({ data: [{ id: '1', name: 'Haircut', duration_minutes: 30, price: 5000, active: true }] });
    servicesTable.push({ error: null });
    const result: any = await applyUpdateService(BUSINESS_ID, { serviceName: 'Haircut', changes: { price: 6000 } });
    expect(result.updated).toBe(true);
    expect(servicesTable.updatePayloads[0]).toMatchObject({ price: 6000 });
  });

  it('sets a newly attached photo unconditionally, even if it looks like "the same" photo - the refuse-if-identical gate was reverted on purpose', async () => {
    servicesTable.push({ data: [{ id: '1', name: 'Haircut', duration_minutes: 30, price: 5000, active: true, image_url: null }] });
    servicesTable.push({ error: null });
    const result: any = await applyUpdateService(BUSINESS_ID, { serviceName: 'Haircut', changes: { imageUrl: REAL_IMAGE_URL } });
    expect(result.updated).toBe(true);
    expect(servicesTable.updatePayloads[0]).toMatchObject({ image_url: REAL_IMAGE_URL });
  });
});

describe('propose/apply_toggle_setting', () => {
  it('rejects an unknown setting name', async () => {
    const result: any = await proposeToggleSetting(BUSINESS_ID, { setting: 'nonsense', enabled: true });
    expect(result.error).toMatch(/unknown setting/i);
  });

  it('refuses to enable payment when no payout account is linked yet', async () => {
    businessesTable.push({ data: { flw_subaccount_id: null } });
    const result: any = await proposeToggleSetting(BUSINESS_ID, { setting: 'payment', enabled: true });
    expect(result.error).toMatch(/no payout account is linked/);
  });

  it('allows proposing payment ON once a payout account is linked', async () => {
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123' } });
    const result: any = await proposeToggleSetting(BUSINESS_ID, { setting: 'payment', enabled: true });
    expect(result.will_become).toMatch(/turned ON/);
  });

  it('never needs a payout account to turn payment OFF', async () => {
    const result: any = await proposeToggleSetting(BUSINESS_ID, { setting: 'payment', enabled: false });
    expect(result.will_become).toMatch(/turned OFF/);
    expect(businessesTable.updatePayloads).toHaveLength(0);
  });

  it('re-checks the payout account at apply time too, not just propose time', async () => {
    businessesTable.push({ data: { flw_subaccount_id: null } });
    const result: any = await applyToggleSetting(BUSINESS_ID, { setting: 'payment', enabled: true });
    expect(result.error).toMatch(/cannot turn payments on/i);
  });

  it('toggles a businesses-table setting (about/gallery/contact) on the businesses row', async () => {
    businessesTable.push({ error: null });
    const result: any = await applyToggleSetting(BUSINESS_ID, { setting: 'about', enabled: false });
    expect(result).toMatchObject({ applied: true, setting: 'about', enabled: false });
    expect(businessesTable.updatePayloads[0]).toEqual({ show_about: false });
  });

  it('toggles the payment setting on booking_rules, not businesses', async () => {
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123' } });
    bookingRulesTable.push({ error: null });
    await applyToggleSetting(BUSINESS_ID, { setting: 'payment', enabled: true });
    expect(bookingRulesTable.updatePayloads[0]).toEqual({ require_payment: true });
    expect(businessesTable.updatePayloads).toHaveLength(0);
  });
});

describe('propose/apply_update_profile', () => {
  it('errors gracefully when the current business profile cannot be loaded', async () => {
    businessesTable.push({ data: null });
    const result: any = await proposeUpdateProfile(BUSINESS_ID, { name: 'New Name' });
    expect(result.error).toMatch(/could not load/i);
  });

  it('proposes nothing when the new name matches the current one exactly', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', description: null, logo_url: null, cover_image_url: null, accent_color: '#C4512D' } });
    const result: any = await proposeUpdateProfile(BUSINESS_ID, { name: 'Glow Salon' });
    expect(result.error).toMatch(/no real changes/i);
  });

  it('rejects an accent color that is not a real hex value', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', description: null, logo_url: null, cover_image_url: null, accent_color: '#C4512D' } });
    const result: any = await proposeUpdateProfile(BUSINESS_ID, { accentColor: 'blue' });
    expect(result.error).toMatch(/real hex color/);
  });

  it('rejects a logo URL that is not a real upload from this business’s own chat', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', description: null, logo_url: null, cover_image_url: null, accent_color: '#C4512D' } });
    const result: any = await proposeUpdateProfile(BUSINESS_ID, { logoUrl: 'https://evil.example.com/logo.png' });
    expect(result.error).toMatch(/doesn't look like a photo/);
  });

  it('applies a real name and accent color change directly - no re-fetch of current values needed at apply time', async () => {
    businessesTable.push({ error: null });
    const result: any = await applyUpdateProfile(BUSINESS_ID, { name: 'glow salon', accentColor: '#1769AA' });
    expect(result.updated).toBe(true);
    expect(businessesTable.updatePayloads[0]).toMatchObject({ name: 'Glow salon', accent_color: '#1769AA' });
  });

  it('rejects applying with nothing real to change', async () => {
    const result: any = await applyUpdateProfile(BUSINESS_ID, {});
    expect(result.error).toMatch(/nothing to update/i);
    expect(businessesTable.updatePayloads).toHaveLength(0);
  });
});

describe('propose/apply_update_booking_rules', () => {
  it('rejects a buffer time outside 0-180 minutes', async () => {
    bookingRulesTable.push({ data: { buffer_minutes: 0, deposit_percentage: null, require_payment: false } });
    businessesTable.push({ data: { flw_subaccount_id: null } });
    const result: any = await proposeUpdateBookingRules(BUSINESS_ID, { bufferMinutes: 500 });
    expect(result.error).toMatch(/0 and 180/);
  });

  it('refuses to propose a deposit percentage when payment isn’t turned on yet, steering to the real prerequisite', async () => {
    bookingRulesTable.push({ data: { buffer_minutes: 0, deposit_percentage: null, require_payment: false } });
    businessesTable.push({ data: { flw_subaccount_id: null } });
    const result: any = await proposeUpdateBookingRules(BUSINESS_ID, { depositPercentage: 50 });
    expect(result.error).toMatch(/payment isn't turned on/i);
  });

  it('warns with a caveat, but still proposes, a deposit percentage when payment is on but no payout account is linked yet', async () => {
    bookingRulesTable.push({ data: { buffer_minutes: 0, deposit_percentage: null, require_payment: true } });
    businessesTable.push({ data: { flw_subaccount_id: null } });
    const result: any = await proposeUpdateBookingRules(BUSINESS_ID, { depositPercentage: 50 });
    expect(result.changes.deposit_percentage.to).toBe('50% deposit');
    expect(result.caveat).toMatch(/no bank account is linked/);
  });

  it('proposes a clean deposit percentage, no caveat, once payment is on and a payout account is linked', async () => {
    bookingRulesTable.push({ data: { buffer_minutes: 0, deposit_percentage: null, require_payment: true } });
    businessesTable.push({ data: { flw_subaccount_id: 'sub_123' } });
    const result: any = await proposeUpdateBookingRules(BUSINESS_ID, { depositPercentage: 100 });
    expect(result.changes.deposit_percentage.to).toBe('full payment');
    expect(result.caveat).toBeUndefined();
  });

  it('applies a real buffer-time change', async () => {
    bookingRulesTable.push({ error: null });
    const result: any = await applyUpdateBookingRules(BUSINESS_ID, { bufferMinutes: 15 });
    expect(result.updated).toBe(true);
    expect(bookingRulesTable.updatePayloads[0]).toEqual({ buffer_minutes: 15 });
  });
});

describe('propose/apply_update_hours', () => {
  it('sets several days to the same hours in one call - the real fix for the "only Monday confirmed" bug', async () => {
    availabilityTable.push({ data: [] }, { data: [] }, { data: [] });
    bookingsTable.push({ data: [] }, { data: [] }, { data: [] });

    const result: any = await proposeUpdateHours(BUSINESS_ID, { daysOfWeek: [1, 2, 3], startTime: '09:00', endTime: '17:00' });

    expect(result.days).toHaveLength(3);
    expect(result.days.map((d: any) => d.day)).toEqual(['Monday', 'Tuesday', 'Wednesday']);
  });

  it('rejects a closing time that is not after opening time', async () => {
    const result: any = await proposeUpdateHours(BUSINESS_ID, { daysOfWeek: [1], startTime: '17:00', endTime: '09:00' });
    expect(result.error).toMatch(/after opening time/);
  });

  it('flags an existing booking that would fall outside the new hours, without silently moving or cancelling it', async () => {
    availabilityTable.push({ data: [{ start_time: '09:00', end_time: '17:00' }] });
    bookingsTable.push({
      data: [{ customer_name: 'Amara', start_time: '2026-01-05T07:00:00.000Z' }], // 08:00 WAT Monday, before the proposed 10:00 start
    });

    const result: any = await proposeUpdateHours(BUSINESS_ID, { daysOfWeek: [1], startTime: '10:00', endTime: '17:00' });

    expect(result.conflicting_bookings).toHaveLength(1);
    expect(result.conflicting_bookings[0]).toMatchObject({ day: 'Monday', customer_name: 'Amara' });
    expect(result.note).toMatch(/will NOT be moved or cancelled/);
  });

  it('applies every requested day in one call, atomically per day, via delete-then-insert', async () => {
    availabilityTable.push({ error: null }, { error: null }, { error: null }, { error: null });

    const result: any = await applyUpdateHours(BUSINESS_ID, { daysOfWeek: [1, 2], startTime: '09:00', endTime: '17:00' });

    expect(result).toMatchObject({ applied: true, days: ['Monday', 'Tuesday'], now: '09:00-17:00' });
    expect(availabilityTable.insertPayloads).toHaveLength(2);
  });

  it('closing a day deletes the existing hours row without inserting a new one', async () => {
    availabilityTable.push({ error: null });
    const result: any = await applyUpdateHours(BUSINESS_ID, { daysOfWeek: [0], closed: true });
    expect(result.now).toBe('closed');
    expect(availabilityTable.insertPayloads).toHaveLength(0);
  });

  it('reports a day individually as failed rather than losing or silently skipping the ones that worked', async () => {
    availabilityTable.push({ error: null }); // Monday delete ok
    availabilityTable.push({ error: null }); // Monday insert ok
    availabilityTable.push({ error: { message: 'db error' } }); // Tuesday delete fails

    const result: any = await applyUpdateHours(BUSINESS_ID, { daysOfWeek: [1, 2], startTime: '09:00', endTime: '17:00' });

    expect(result.applied).toBe(true);
    expect(result.days).toEqual(['Monday']);
    expect(result.failed_days).toEqual(['Tuesday']);
  });
});

describe('propose/apply_create_reminder', () => {
  it('rejects a reminder time that has already passed', async () => {
    const result: any = await proposeCreateReminder(BUSINESS_ID, { message: 'Call the supplier', remindAt: '2020-01-01T10:00:00.000Z' });
    expect(result.error).toMatch(/ahead of now/);
  });

  it('proposes a real, future reminder', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result: any = await proposeCreateReminder(BUSINESS_ID, { message: 'Call the supplier', remindAt: future });
    expect(result.proposed.message).toBe('Call the supplier');
  });

  it('creates a real reminder', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    ownerRemindersTable.push({ data: null }); // no existing duplicate
    ownerRemindersTable.push({ error: null }); // insert

    const result: any = await applyCreateReminder(BUSINESS_ID, { message: 'Call the supplier', remindAt: future });

    expect(result.applied).toBe(true);
    expect(ownerRemindersTable.insertPayloads).toHaveLength(1);
  });

  it('a repeat apply_create_reminder call for the same reminder is a no-op, not a second page to the owner - the exact bug fixed this session', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    ownerRemindersTable.push({ data: { id: 'existing' } }); // duplicate check finds it

    const result: any = await applyCreateReminder(BUSINESS_ID, { message: 'Call the supplier', remindAt: future });

    expect(result).toMatchObject({ applied: true, already_existed: true });
    expect(ownerRemindersTable.insertPayloads).toHaveLength(0);
  });
});

describe('propose/apply_email_customer', () => {
  it('rejects a customer name with no match at all', async () => {
    bookingsTable.push({ data: [] });
    const result: any = await proposeEmailCustomer(BUSINESS_ID, { customerName: 'Nobody', subject: 'Hi', message: 'Test' });
    expect(result.error).toMatch(/no customer found/i);
  });

  it('needs disambiguation when more than one distinct customer matches (deduped by email, not name)', async () => {
    bookingsTable.push({
      data: [
        { customer_name: 'Chioma', customer_email: 'chioma1@example.com', start_time: '2026-01-01T00:00:00Z' },
        { customer_name: 'Chioma', customer_email: 'chioma2@example.com', start_time: '2026-01-02T00:00:00Z' },
      ],
    });
    const result: any = await proposeEmailCustomer(BUSINESS_ID, { customerName: 'Chioma', subject: 'Hi', message: 'Test' });
    expect(result.needs_disambiguation).toBe(true);
    expect(result.matches).toHaveLength(2);
  });

  it('treats repeat bookings under the same email as one customer, using their most recent name', async () => {
    bookingsTable.push({
      data: [
        { customer_name: 'Chioma A.', customer_email: 'chioma@example.com', start_time: '2026-02-01T00:00:00Z' },
        { customer_name: 'Chioma', customer_email: 'chioma@example.com', start_time: '2026-01-01T00:00:00Z' },
      ],
    });
    const result: any = await proposeEmailCustomer(BUSINESS_ID, { customerName: 'Chioma', subject: 'Hi', message: 'Test' });
    expect(result.proposed.customer_name).toBe('Chioma A.');
  });

  it('refuses to propose emailing a customer with no email on file', async () => {
    bookingsTable.push({ data: [{ customer_name: 'Tunde', customer_email: null, start_time: '2026-01-01T00:00:00Z' }] });
    const result: any = await proposeEmailCustomer(BUSINESS_ID, { customerName: 'Tunde', subject: 'Hi', message: 'Test' });
    expect(result.error).toMatch(/no email on file/);
  });

  it('sends the email on a real apply call', async () => {
    bookingsTable.push({ data: [{ customer_name: 'Chioma', customer_email: 'chioma@example.com', start_time: '2026-01-01T00:00:00Z' }] });
    businessesTable.push({ data: { name: 'Glow Salon', accent_color: '#C4512D', logo_url: null } });

    const result: any = await applyEmailCustomer(BUSINESS_ID, { customerName: 'Chioma', subject: 'Reminder', message: 'See you soon!' });

    expect(result.applied).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('a repeat apply_email_customer call for the same customer/subject/message within the dedupe window sends nothing a second time', async () => {
    bookingsTable.push({ data: [{ customer_name: 'Chioma', customer_email: 'chioma@example.com', start_time: '2026-01-01T00:00:00Z' }] });
    rateLimitMock.mockResolvedValueOnce(false); // the dedupe guard says "already sent recently"

    const result: any = await applyEmailCustomer(BUSINESS_ID, { customerName: 'Chioma', subject: 'Reminder', message: 'See you soon!' });

    expect(result).toMatchObject({ applied: true, already_sent: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('reports a real send failure rather than claiming success', async () => {
    bookingsTable.push({ data: [{ customer_name: 'Chioma', customer_email: 'chioma@example.com', start_time: '2026-01-01T00:00:00Z' }] });
    businessesTable.push({ data: { name: 'Glow Salon' } });
    sendEmailMock.mockResolvedValueOnce(false);

    const result: any = await applyEmailCustomer(BUSINESS_ID, { customerName: 'Chioma', subject: 'Reminder', message: 'See you soon!' });

    expect(result.error).toMatch(/didn't send/);
  });
});
