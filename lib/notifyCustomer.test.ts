import { beforeEach, describe, expect, it, vi } from 'vitest';

// "message a customer through whichever channel they actually booked
// through, falling back to email if that channel's since been
// disconnected" - the one shared implementation the reminders cron route
// and the reschedule feature both now call, replacing what used to be a
// second copy of the same channel-routing logic silently drifting from
// the original. parseContact (lib/contact.ts) is pure string logic with
// no external dependencies, left real here rather than mocked - the
// actual behavior worth testing is the routing built on top of it.
type TableResult = { data?: unknown; error?: unknown };
function makeTable() {
  const queue: TableResult[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = { select: () => self, eq: () => self, maybeSingle: () => Promise.resolve(next()) };
  return { self, push: (...items: TableResult[]) => queue.push(...items) };
}
const businessesTable = makeTable();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => businessesTable.self }),
}));

const channelSend = {
  sendTelegramMessage: vi.fn(),
  sendWhatsappMessage: vi.fn(),
  sendMessengerMessage: vi.fn(),
};
vi.mock('./channelSend', () => channelSend);

const sendEmailMock = vi.fn();
vi.mock('./email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const renderEmailMock = vi.fn().mockReturnValue('<html></html>');
vi.mock('./emailTemplate', () => ({ renderEmail: (...args: unknown[]) => renderEmailMock(...args) }));

const { notifyCustomer, getNotifyCreds } = await import('./notifyCustomer');

function creds(overrides: Partial<Parameters<typeof notifyCustomer>[0]> = {}) {
  return {
    telegram_bot_token: null,
    whatsapp_access_token: null,
    whatsapp_phone_number_id: null,
    messenger_access_token: null,
    name: 'Glow Salon',
    accent_color: '#C74A1E',
    logo_url: 'https://x/logo.png',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  channelSend.sendTelegramMessage.mockResolvedValue(true);
  channelSend.sendWhatsappMessage.mockResolvedValue(true);
  channelSend.sendMessengerMessage.mockResolvedValue(true);
  sendEmailMock.mockResolvedValue(true);
});

describe('notifyCustomer - bot channel routing', () => {
  it('sends over Telegram when the phone is telegram:-prefixed and the business has a bot token, stripping the prefix for the chatId', async () => {
    const result = await notifyCustomer(
      creds({ telegram_bot_token: 'bot-token' }),
      { customer_phone: 'telegram:123456', customer_email: null },
      'Your appointment is tomorrow',
      'Reminder',
      'test'
    );
    expect(result).toBe(true);
    expect(channelSend.sendTelegramMessage).toHaveBeenCalledWith('bot-token', '123456', 'Your appointment is tomorrow');
  });

  it('sends over WhatsApp when the phone is whatsapp:-prefixed and the business has both the access token and phone number id', async () => {
    await notifyCustomer(
      creds({ whatsapp_access_token: 'wa-token', whatsapp_phone_number_id: 'phone-id' }),
      { customer_phone: 'whatsapp:+2348000000001', customer_email: null },
      'hi',
      'Reminder',
      'test'
    );
    expect(channelSend.sendWhatsappMessage).toHaveBeenCalledWith('wa-token', 'phone-id', 'whatsapp:+2348000000001', 'hi');
  });

  it('sends over Messenger when the phone is messenger:-prefixed and the business has an access token, stripping the prefix for the psid', async () => {
    await notifyCustomer(
      creds({ messenger_access_token: 'page-token' }),
      { customer_phone: 'messenger:psid-123', customer_email: null },
      'hi',
      'Reminder',
      'test'
    );
    expect(channelSend.sendMessengerMessage).toHaveBeenCalledWith('page-token', 'psid-123', 'hi');
  });

  it('propagates a failed send from the underlying channel as false, not silently "handled"', async () => {
    channelSend.sendTelegramMessage.mockResolvedValue(false);
    const result = await notifyCustomer(
      creds({ telegram_bot_token: 'bot-token' }),
      { customer_phone: 'telegram:123456', customer_email: null },
      'hi',
      'Reminder',
      'test'
    );
    expect(result).toBe(false);
  });
});

describe('notifyCustomer - falling back to email', () => {
  it('falls back to email when the customer’s channel is telegram but the business has since disconnected its bot token', async () => {
    const result = await notifyCustomer(
      creds({ telegram_bot_token: null }),
      { customer_phone: 'telegram:123456', customer_email: 'jane@x.com' },
      'hi',
      'Reminder',
      'test'
    );
    expect(channelSend.sendTelegramMessage).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('falls back to email for a plain "direct" phone (a manually-entered booking, not a bot channel)', async () => {
    await notifyCustomer(
      creds(),
      { customer_phone: '+2348000000001', customer_email: 'jane@x.com' },
      'hi',
      'Reminder',
      'test'
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'jane@x.com', subject: 'Reminder', fromName: 'Glow Salon' }),
      'test',
      undefined
    );
  });

  it('sends the email branded with the business name/accent color/logo and the given rows', async () => {
    await notifyCustomer(
      creds(),
      { customer_phone: null, customer_email: 'jane@x.com' },
      'Your appointment was moved',
      'Booking rescheduled',
      'test',
      { bookingId: 'b1' },
      [{ label: 'New time', value: 'Tomorrow 10am' }]
    );
    const renderArgs = renderEmailMock.mock.calls[0][0];
    expect(renderArgs.businessName).toBe('Glow Salon');
    expect(renderArgs.accentColor).toBe('#C74A1E');
    expect(renderArgs.rows).toEqual([{ label: 'New time', value: 'Tomorrow 10am' }]);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.anything(), 'test', { bookingId: 'b1' });
  });

  it('returns false when there is no bot channel available and no email on file at all', async () => {
    const result = await notifyCustomer(creds(), { customer_phone: null, customer_email: null }, 'hi', 'Reminder', 'test');
    expect(result).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('getNotifyCreds', () => {
  it('returns the full row when the combined select succeeds', async () => {
    businessesTable.push({
      data: {
        name: 'Glow Salon',
        accent_color: '#C74A1E',
        logo_url: 'https://x/logo.png',
        telegram_bot_token: 'bot-token',
        whatsapp_access_token: 'wa-token',
        whatsapp_phone_number_id: 'phone-id',
        messenger_access_token: 'page-token',
      },
      error: null,
    });
    const result = await getNotifyCreds('biz-1');
    expect(result.whatsapp_access_token).toBe('wa-token');
    expect(result.name).toBe('Glow Salon');
  });

  it('falls back to a WhatsApp-column-free select on a 42703 (missing column) error, resolving WhatsApp as not connected without taking Telegram/Messenger down with it', async () => {
    businessesTable.push(
      { data: null, error: { code: '42703' } },
      { data: { name: 'Glow Salon', accent_color: null, logo_url: null, telegram_bot_token: 'bot-token', messenger_access_token: 'page-token' }, error: null }
    );
    const result = await getNotifyCreds('biz-1');
    expect(result.whatsapp_access_token).toBeNull();
    expect(result.whatsapp_phone_number_id).toBeNull();
    expect(result.telegram_bot_token).toBe('bot-token');
    expect(result.messenger_access_token).toBe('page-token');
  });

  it('returns an all-null object rather than throwing when the business row itself is missing', async () => {
    businessesTable.push({ data: null, error: null });
    const result = await getNotifyCreds('biz-1');
    expect(result).toEqual({
      name: null,
      accent_color: null,
      logo_url: null,
      telegram_bot_token: null,
      whatsapp_access_token: null,
      whatsapp_phone_number_id: null,
      messenger_access_token: null,
    });
  });
});
