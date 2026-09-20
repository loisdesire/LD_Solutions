import { beforeEach, describe, expect, it, vi } from 'vitest';

// Dispatcher between the OpenAI tool schema (snake_case) and
// lib/manageTools.ts's real functions (camelCase). This is the file with a
// documented, confirmed-live regression already fixed once: the tool
// schema for propose_update_service/apply_update_service declares
// image_url/duration_minutes in its `changes` object (what the model
// correctly sends), but the underlying functions check changes.imageUrl/
// changes.durationMinutes - a dispatcher that never translated between the
// two, so a service photo update silently did nothing on every call ever
// made, regardless of what the model did. mapUpdateServiceChanges is the
// fix; this file exercises it (and mapServicesArgs' two accepted shapes)
// through executeManageTool directly, since neither helper is exported.
const manageTools = {
  proposeCreateService: vi.fn(),
  applyCreateService: vi.fn(),
  proposeUpdateService: vi.fn(),
  applyUpdateService: vi.fn(),
  proposeToggleSetting: vi.fn(),
  applyToggleSetting: vi.fn(),
  proposeUpdateProfile: vi.fn(),
  applyUpdateProfile: vi.fn(),
  proposeUpdateBookingRules: vi.fn(),
  applyUpdateBookingRules: vi.fn(),
  proposeUpdateHours: vi.fn(),
  applyUpdateHours: vi.fn(),
  proposeCreateReminder: vi.fn(),
  applyCreateReminder: vi.fn(),
  proposeEmailCustomer: vi.fn(),
  applyEmailCustomer: vi.fn(),
};
vi.mock('./manageTools', () => manageTools);

const { executeManageTool, MANAGE_TOOLS } = await import('./manageAgent');

const BIZ = 'biz-1';

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(manageTools).forEach((fn) => fn.mockResolvedValue({ ok: true }));
});

describe('executeManageTool - services (the regression this file exists for)', () => {
  it('propose_update_service maps changes.image_url -> changes.imageUrl and changes.duration_minutes -> changes.durationMinutes - the actual bug fix', async () => {
    await executeManageTool(
      'propose_update_service',
      { service_name: 'Haircut', changes: { image_url: 'https://x/y.jpg', duration_minutes: 45 } },
      BIZ
    );
    expect(manageTools.proposeUpdateService).toHaveBeenCalledWith(BIZ, {
      serviceName: 'Haircut',
      changes: { imageUrl: 'https://x/y.jpg', durationMinutes: 45 },
    });
  });

  it('apply_update_service maps the same way', async () => {
    await executeManageTool(
      'apply_update_service',
      { service_name: 'Haircut', changes: { image_url: 'https://x/y.jpg' } },
      BIZ
    );
    expect(manageTools.applyUpdateService).toHaveBeenCalledWith(BIZ, {
      serviceName: 'Haircut',
      changes: { imageUrl: 'https://x/y.jpg' },
    });
  });

  it('identically-spelled fields (name, price, description, active) pass through unchanged', async () => {
    await executeManageTool(
      'propose_update_service',
      { service_name: 'Haircut', changes: { name: 'Deluxe Haircut', price: 6000, description: 'Nice cut', active: false } },
      BIZ
    );
    expect(manageTools.proposeUpdateService).toHaveBeenCalledWith(BIZ, {
      serviceName: 'Haircut',
      changes: { name: 'Deluxe Haircut', price: 6000, description: 'Nice cut', active: false },
    });
  });

  it('only includes fields actually present in changes, not undefined placeholders for the rest', async () => {
    await executeManageTool('propose_update_service', { service_name: 'Haircut', changes: { price: 6000 } }, BIZ);
    const [, arg] = manageTools.proposeUpdateService.mock.calls[0];
    expect(Object.keys(arg.changes)).toEqual(['price']);
  });

  it('propose_create_service wraps a `services` array into the camelCase shape createService expects', async () => {
    await executeManageTool(
      'propose_create_service',
      { services: [{ name: 'Haircut', duration_minutes: 30, price: 5000 }] },
      BIZ
    );
    expect(manageTools.proposeCreateService).toHaveBeenCalledWith(BIZ, {
      services: [{ name: 'Haircut', durationMinutes: 30, price: 5000, description: undefined, imageUrl: undefined, category: undefined }],
    });
  });

  it('propose_create_service also accepts a single flat service with no `services` wrapper, for a model that reverts to the old shape', async () => {
    await executeManageTool('propose_create_service', { name: 'Haircut', duration_minutes: 30 }, BIZ);
    const [, arg] = manageTools.proposeCreateService.mock.calls[0];
    expect(arg.services).toHaveLength(1);
    expect(arg.services[0]).toEqual(
      expect.objectContaining({ name: 'Haircut', durationMinutes: 30 })
    );
  });

  it('apply_create_service maps every service in the batch, not just the first', async () => {
    await executeManageTool(
      'apply_create_service',
      { services: [{ name: 'Haircut', duration_minutes: 30 }, { name: 'Beard trim', duration_minutes: 20 }] },
      BIZ
    );
    const [, arg] = manageTools.applyCreateService.mock.calls[0];
    expect(arg.services).toHaveLength(2);
    expect(arg.services.map((s: { name: string }) => s.name)).toEqual(['Haircut', 'Beard trim']);
  });
});

describe('executeManageTool - everything else', () => {
  it('routes propose_toggle_setting/apply_toggle_setting straight through', async () => {
    await executeManageTool('propose_toggle_setting', { setting: 'payment', enabled: true }, BIZ);
    expect(manageTools.proposeToggleSetting).toHaveBeenCalledWith(BIZ, { setting: 'payment', enabled: true });
    await executeManageTool('apply_toggle_setting', { setting: 'payment', enabled: true }, BIZ);
    expect(manageTools.applyToggleSetting).toHaveBeenCalledWith(BIZ, { setting: 'payment', enabled: true });
  });

  it('routes propose_update_profile/apply_update_profile, mapping to camelCase', async () => {
    await executeManageTool(
      'propose_update_profile',
      { name: 'Glow Salon', logo_url: 'https://x/logo.png', cover_image_url: 'https://x/cover.png', accent_color: '#C74A1E' },
      BIZ
    );
    expect(manageTools.proposeUpdateProfile).toHaveBeenCalledWith(BIZ, {
      name: 'Glow Salon',
      description: undefined,
      logoUrl: 'https://x/logo.png',
      coverImageUrl: 'https://x/cover.png',
      accentColor: '#C74A1E',
    });
  });

  it('routes propose_update_booking_rules/apply_update_booking_rules, mapping to camelCase', async () => {
    await executeManageTool('propose_update_booking_rules', { buffer_minutes: 15, deposit_percentage: 50 }, BIZ);
    expect(manageTools.proposeUpdateBookingRules).toHaveBeenCalledWith(BIZ, { bufferMinutes: 15, depositPercentage: 50 });
  });

  it('routes propose_update_hours/apply_update_hours, passing the whole days_of_week array through as one call', async () => {
    await executeManageTool(
      'propose_update_hours',
      { days_of_week: [1, 2, 3, 4, 5], start_time: '09:00', end_time: '18:00', closed: false },
      BIZ
    );
    expect(manageTools.proposeUpdateHours).toHaveBeenCalledWith(BIZ, {
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '18:00',
      closed: false,
    });
  });

  it('routes propose_create_reminder/apply_create_reminder, mapping remind_at to camelCase', async () => {
    await executeManageTool('propose_create_reminder', { message: 'Call supplier', remind_at: '2026-06-02T14:00:00Z' }, BIZ);
    expect(manageTools.proposeCreateReminder).toHaveBeenCalledWith(BIZ, { message: 'Call supplier', remindAt: '2026-06-02T14:00:00Z' });
  });

  it('routes propose_email_customer/apply_email_customer, mapping customer_name to camelCase', async () => {
    await executeManageTool(
      'propose_email_customer',
      { customer_name: 'Sarah', subject: 'Closed Friday', message: 'We are closed this Friday.' },
      BIZ
    );
    expect(manageTools.proposeEmailCustomer).toHaveBeenCalledWith(BIZ, {
      customerName: 'Sarah',
      subject: 'Closed Friday',
      message: 'We are closed this Friday.',
    });
  });

  it('returns an error object for an unknown tool name rather than throwing', async () => {
    const result = await executeManageTool('not_a_real_tool', {}, BIZ);
    expect(result).toEqual({ error: 'Unknown tool: not_a_real_tool' });
  });
});

describe('MANAGE_TOOLS', () => {
  it('declares exactly one OpenAI tool schema per executeManageTool case, with matching names', () => {
    const names = MANAGE_TOOLS.map((t) => (t.type === 'function' ? t.function.name : null));
    expect(names).toEqual([
      'propose_create_service',
      'apply_create_service',
      'propose_update_service',
      'apply_update_service',
      'propose_toggle_setting',
      'apply_toggle_setting',
      'propose_update_profile',
      'apply_update_profile',
      'propose_update_booking_rules',
      'apply_update_booking_rules',
      'propose_update_hours',
      'apply_update_hours',
      'propose_create_reminder',
      'apply_create_reminder',
      'propose_email_customer',
      'apply_email_customer',
    ]);
  });
});
