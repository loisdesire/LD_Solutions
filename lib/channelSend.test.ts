import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The actual fix for a confirmed live bug: a correct AI reply, generated
// and saved, that never reached the customer because a single transient
// network blip talking to Telegram/Twilio/Meta wasn't retried and wasn't
// even detected in every case (a non-throwing HTTP error response looks
// like success unless the provider's own body is checked, not just
// whether fetch() itself threw). Shared by the webhook route (agent
// replies) and the admin "message this customer" route (human replies).
vi.mock('./logger', () => ({ logError: vi.fn() }));
const { logError } = await import('./logger');
const { sendTelegramMessage, sendWhatsappMessage, sendMessengerMessage } = await import('./channelSend');

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}
function errorResponse(status: number, body: unknown) {
  return { ok: false, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('sendTelegramMessage', () => {
  it('returns true on the first attempt when Telegram genuinely accepts the message', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }));
    const result = await sendTelegramMessage('token', 12345, 'hi', 1);
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a 200 with ok: false in the body as a failure, not a success - a non-throwing provider error still needs checking', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: false, description: 'chat not found' }));
    const result = await sendTelegramMessage('token', 12345, 'hi', 1);
    expect(result).toBe(false);
    expect(logError).toHaveBeenCalledWith('channelSend:telegram', expect.any(Error), { chatId: 12345, attempt: 1 });
  });

  it('retries after a thrown network error and succeeds on a later attempt', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network blip')).mockResolvedValueOnce(okResponse({ ok: true }));
    const result = await sendTelegramMessage('token', 12345, 'hi', 2);
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it('gives up and returns false after exhausting every attempt', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, { ok: false }));
    const result = await sendTelegramMessage('token', 12345, 'hi', 2);
    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('sendWhatsappMessage', () => {
  it('strips the internal "whatsapp:+234..." format down to bare digits before calling Meta', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await sendWhatsappMessage('token', 'phone-id', 'whatsapp:+2348000000001', 'hi', 1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.to).toBe('2348000000001');
  });

  it('returns true on a real 200 from Meta', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    const result = await sendWhatsappMessage('token', 'phone-id', '+2348000000001', 'hi', 1);
    expect(result).toBe(true);
  });

  it('returns false and logs the response body on a non-ok status, without retrying past the given attempt count', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, { error: { message: 'Invalid token' } }));
    const result = await sendWhatsappMessage('token', 'phone-id', '+2348000000001', 'hi', 1);
    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('channelSend:whatsapp', expect.any(Error), { to: '+2348000000001', attempt: 1 });
  });
});

describe('sendMessengerMessage', () => {
  it('sends the page-scoped id as recipient.id, not a phone number', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await sendMessengerMessage('page-token', 'psid-123', 'hi', 1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.recipient).toEqual({ id: 'psid-123' });
  });

  it('returns true on a real 200 from Meta', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    const result = await sendMessengerMessage('page-token', 'psid-123', 'hi', 1);
    expect(result).toBe(true);
  });

  it('returns false on a non-ok status', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, { error: { message: 'Forbidden' } }));
    const result = await sendMessengerMessage('page-token', 'psid-123', 'hi', 1);
    expect(result).toBe(false);
  });
});
