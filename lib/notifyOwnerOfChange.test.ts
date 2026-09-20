import { beforeEach, describe, expect, it, vi } from 'vitest';

// "for every change, there's a confirmation AND an email" - the audit
// trail to the owner's inbox for every real write the assistant makes,
// on any channel, by owner or staff. describeManageToolChange is the
// pure half (turns a tool call + result into a structured summary) and
// carries real branching logic per tool worth testing directly;
// notifyOwnerByEmail/notifyOwnerOfManageChange is the DB+email side,
// tested for its two real behaviors: silently skipping when the business
// has no owner email on file, and swallowing (not throwing) a send
// failure so a notification problem never looks like the real event
// (already happened) failed.
type TableResult = { data?: unknown; error?: unknown };
function makeTable() {
  const queue: TableResult[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = {
    select: () => self,
    eq: () => self,
    maybeSingle: () => Promise.resolve(next()),
  };
  return { self, push: (...items: TableResult[]) => queue.push(...items) };
}

const businessesTable = makeTable();
const staffTable = makeTable();
const TABLES: Record<string, ReturnType<typeof makeTable>> = { businesses: businessesTable, staff: staffTable };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const t = TABLES[table];
      if (!t) throw new Error(`test double doesn't expect a query against "${table}"`);
      return t.self;
    },
  }),
}));

const sendEmailMock = vi.fn();
vi.mock('./email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const renderEmailMock = vi.fn().mockReturnValue('<html></html>');
vi.mock('./emailTemplate', () => ({ renderEmail: (...args: unknown[]) => renderEmailMock(...args) }));

vi.mock('./formatMoney', () => ({ formatMoney: (n: number) => `₦${n}` }));
vi.mock('./site', () => ({ SITE_URL: 'https://vanovahub.com' }));
vi.mock('./logger', () => ({ logError: vi.fn() }));

const { describeManageToolChange, notifyOwnerByEmail, notifyOwnerOfManageChange } = await import('./notifyOwnerOfChange');
const { logError } = await import('./logger');

const BIZ = 'biz-1';

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailMock.mockResolvedValue(undefined);
  renderEmailMock.mockReturnValue('<html></html>');
});

describe('describeManageToolChange', () => {
  it('returns null for any propose_* call - nothing has actually changed yet', () => {
    expect(describeManageToolChange('propose_update_service', { service_name: 'Haircut', changes: { price: 6000 } }, { proposed: true })).toBeNull();
  });

  it('returns null for an apply_* call whose result carries an error - the write itself failed', () => {
    expect(describeManageToolChange('apply_update_service', {}, { error: 'not found' })).toBeNull();
  });

  it('returns null when the result is missing or not an object', () => {
    expect(describeManageToolChange('apply_update_service', {}, null)).toBeNull();
    expect(describeManageToolChange('apply_update_service', {}, undefined)).toBeNull();
  });

  it('apply_create_service: names the service, duration, price, and only includes category when given', () => {
    const summary = describeManageToolChange('apply_create_service', { name: 'Haircut', duration_minutes: 30, price: 5000 }, { applied: true });
    expect(summary?.intro).toBe('A new service was created.');
    expect(summary?.rows).toEqual([
      { label: 'Service', value: 'Haircut' },
      { label: 'Duration', value: '30 min' },
      { label: 'Price', value: '₦5000' },
    ]);
  });

  it('apply_create_service: an unpriced service reads "Ask for pricing", not a blank/zero row', () => {
    const summary = describeManageToolChange('apply_create_service', { name: 'Custom order' }, { applied: true });
    expect(summary?.rows).toContainEqual({ label: 'Price', value: 'Ask for pricing' });
  });

  it('apply_update_service: only rows for fields actually present in changes, correctly labeled and formatted', () => {
    const summary = describeManageToolChange(
      'apply_update_service',
      { service_name: 'Haircut', changes: { price: 6000, image_url: 'https://x/y.jpg', active: false } },
      { applied: true }
    );
    expect(summary?.intro).toBe('"Haircut" was updated.');
    expect(summary?.rows).toEqual([
      { label: 'price', value: '₦6000' },
      { label: 'photo', value: 'New photo' },
      { label: 'visibility', value: 'Hidden' },
    ]);
  });

  it('apply_toggle_setting: labels the setting and reports On/Off', () => {
    const summary = describeManageToolChange('apply_toggle_setting', { setting: 'payment', enabled: true }, { applied: true });
    expect(summary).toEqual({
      intro: 'A setting was changed.',
      rows: [
        { label: 'Setting', value: 'requiring payment to confirm a booking' },
        { label: 'Status', value: 'On' },
      ],
    });
  });

  it('apply_update_profile: rows only for the fields actually changing, e.g. accent_color uppercased', () => {
    const summary = describeManageToolChange('apply_update_profile', { accent_color: '#c74a1e' }, { applied: true });
    expect(summary?.rows).toEqual([{ label: 'accent color', value: '#C74A1E' }]);
  });

  it('apply_update_hours: names the day and the hours, or "Closed"', () => {
    const summary = describeManageToolChange('apply_update_hours', { day_of_week: 1, start_time: '09:00', end_time: '18:00', closed: false }, { applied: true });
    expect(summary?.rows).toEqual([
      { label: 'Day', value: 'Monday' },
      { label: 'Hours', value: '09:00-18:00' },
    ]);

    const closedSummary = describeManageToolChange('apply_update_hours', { day_of_week: 0, closed: true }, { applied: true });
    expect(closedSummary?.rows).toEqual([
      { label: 'Day', value: 'Sunday' },
      { label: 'Hours', value: 'Closed' },
    ]);
  });

  it('apply_create_reminder: names the message and when', () => {
    const summary = describeManageToolChange('apply_create_reminder', { message: 'Call supplier', remind_at: '2026-06-02T14:00:00Z' }, { applied: true });
    expect(summary).toEqual({
      intro: 'A reminder was set.',
      rows: [
        { label: 'Reminder', value: 'Call supplier' },
        { label: 'When', value: '2026-06-02T14:00:00Z' },
      ],
    });
  });

  it('apply_email_customer: names who it went to and the subject, but not the body', () => {
    const summary = describeManageToolChange('apply_email_customer', { customer_name: 'Sarah', subject: 'Closed Friday', message: 'We are closed.' }, { applied: true });
    expect(summary).toEqual({
      intro: 'An email was sent to a customer.',
      rows: [
        { label: 'To', value: 'Sarah' },
        { label: 'Subject', value: 'Closed Friday' },
      ],
    });
  });

  it('returns null for an unrecognized apply_* tool name', () => {
    expect(describeManageToolChange('apply_something_new', {}, { applied: true })).toBeNull();
  });
});

describe('notifyOwnerByEmail', () => {
  it('sends nothing at all when the business has no owner staff row with an email on file', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', accent_color: null, logo_url: null, slug: 'glow-salon' }, error: null });
    staffTable.push({ data: null, error: null });

    await notifyOwnerByEmail(BIZ, { heading: 'A change happened', intro: 'Something changed.', logContext: 'test' });

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('sends to the owner’s email, branded with the business name/logo/accent color, with a dashboard CTA when a slug exists', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', accent_color: '#C74A1E', logo_url: 'https://x/logo.png', slug: 'glow-salon' }, error: null });
    staffTable.push({ data: { email: 'owner@glow.com' }, error: null });

    await notifyOwnerByEmail(BIZ, { heading: 'A change happened', intro: 'Something changed.', logContext: 'test' });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@glow.com', subject: 'A change happened', fromName: 'Glow Salon' }),
      'test',
      { businessId: BIZ }
    );
    const renderArgs = renderEmailMock.mock.calls[0][0];
    expect(renderArgs.cta).toEqual({ label: 'Open your dashboard', url: 'https://vanovahub.com/glow-salon/admin' });
  });

  it('omits the dashboard CTA when the business has no slug', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', accent_color: null, logo_url: null, slug: null }, error: null });
    staffTable.push({ data: { email: 'owner@glow.com' }, error: null });

    await notifyOwnerByEmail(BIZ, { heading: 'A change happened', intro: 'Something changed.', logContext: 'test' });

    expect(renderEmailMock.mock.calls[0][0].cta).toBeNull();
  });

  it('swallows a send failure rather than throwing - a notification problem must never look like the real event failed', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', accent_color: null, logo_url: null, slug: 'glow-salon' }, error: null });
    staffTable.push({ data: { email: 'owner@glow.com' }, error: null });
    sendEmailMock.mockRejectedValue(new Error('SMTP down'));

    await expect(
      notifyOwnerByEmail(BIZ, { heading: 'A change happened', intro: 'Something changed.', logContext: 'test' })
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith('test', expect.any(Error), { businessId: BIZ });
  });
});

describe('notifyOwnerOfManageChange', () => {
  it('builds the subject from the business name and a standard "wasn’t you" footer note', async () => {
    businessesTable.push({ data: { name: 'Glow Salon', accent_color: null, logo_url: null, slug: 'glow-salon' }, error: null });
    staffTable.push({ data: { email: 'owner@glow.com' }, error: null });

    await notifyOwnerOfManageChange(BIZ, { intro: 'A new service was created.', rows: [{ label: 'Service', value: 'Haircut' }] }, 'Glow Salon');

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'A change was made to Glow Salon' }),
      'notifyOwnerOfManageChange',
      { businessId: BIZ }
    );
    expect(renderEmailMock.mock.calls[0][0].footerNote).toMatch(/Wasn't you/);
  });

  it('falls back to "your business" in the subject when no business name is given', async () => {
    businessesTable.push({ data: { name: null, accent_color: null, logo_url: null, slug: 'glow-salon' }, error: null });
    staffTable.push({ data: { email: 'owner@glow.com' }, error: null });

    await notifyOwnerOfManageChange(BIZ, { intro: 'A change happened.', rows: [] }, null);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'A change was made to your business' }),
      'notifyOwnerOfManageChange',
      { businessId: BIZ }
    );
  });
});
