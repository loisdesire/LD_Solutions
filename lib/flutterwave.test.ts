import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLATFORM_COMMISSION_PCT,
  resolveBankAccount,
  listNigerianBanks,
  createSubaccount,
  initializeSplitTransaction,
  verifyTransaction,
} from './flutterwave';

// This is the one file in the codebase that talks to the payment provider
// that took over from Paystack (see the commit that added it) - it has
// never been exercised against the real Flutterwave API (no live
// credentials exist in this environment). What CAN be verified here,
// with no real account needed: that every function sends the request
// shape Flutterwave's own documentation describes, parses a real success
// response correctly (the fixtures below are copied from Flutterwave's
// docs, not invented), and fails closed - never throws, always returns
// null - on a bad response, malformed JSON, or a network error. A wrong
// field name here (e.g. reading `id` instead of `subaccount_id`) would
// silently break every payment split; these tests are what would have
// caught that before it reached a real business's money.
function mockFetchOnce(response: { ok: boolean; status?: number; json?: unknown; jsonThrows?: boolean }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: response.jsonThrows ? vi.fn().mockRejectedValue(new Error('bad json')) : vi.fn().mockResolvedValue(response.json),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-fake-key-for-tests';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PLATFORM_COMMISSION_PCT', () => {
  it('is 0 by deliberate decision, not an unset placeholder', () => {
    expect(PLATFORM_COMMISSION_PCT).toBe(0);
  });
});

describe('resolveBankAccount', () => {
  it('parses a real success response and authenticates with the secret key', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: { status: 'success', message: 'Account details fetched', data: { account_number: '0690000032', account_name: 'Pastor Bright' } },
    });

    const result = await resolveBankAccount('0690000032', '044');

    expect(result).toEqual({ accountNumber: '0690000032', accountName: 'Pastor Bright' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.flutterwave.com/v3/accounts/resolve');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer FLWSECK_TEST-fake-key-for-tests');
    expect(JSON.parse(init.body)).toEqual({ account_number: '0690000032', account_bank: '044' });
  });

  it('returns null when Flutterwave rejects the account (not throws)', async () => {
    mockFetchOnce({ ok: false, status: 404, json: { status: 'error', message: 'No account found' } });
    await expect(resolveBankAccount('0000000000', '044')).resolves.toBeNull();
  });

  it('returns null on a malformed (non-JSON) response', async () => {
    mockFetchOnce({ ok: true, jsonThrows: true });
    await expect(resolveBankAccount('0690000032', '044')).resolves.toBeNull();
  });

  it('returns null on a network failure rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(resolveBankAccount('0690000032', '044')).resolves.toBeNull();
  });
});

describe('listNigerianBanks', () => {
  it('maps Flutterwave’s bank list to {code, name}', async () => {
    mockFetchOnce({
      ok: true,
      json: { status: 'success', data: [{ id: 1, code: '044', name: 'ACCESS BANK NIGERIA' }, { id: 2, code: '058', name: 'GTBANK' }] },
    });

    const banks = await listNigerianBanks();
    expect(banks).toEqual([{ code: '044', name: 'ACCESS BANK NIGERIA' }, { code: '058', name: 'GTBANK' }]);
  });

  it('returns null rather than an empty list on failure - callers must be able to tell "no banks" from "couldn\'t load"', async () => {
    mockFetchOnce({ ok: false, status: 500, json: { status: 'error' } });
    await expect(listNigerianBanks()).resolves.toBeNull();
  });
});

describe('createSubaccount', () => {
  const params = {
    accountNumber: '0690000037',
    bankCode: '044',
    businessName: 'Glow Salon',
    businessEmail: 'owner@glowsalon.test',
    businessMobile: '08012345678',
  };

  it('reads subaccount_id, not the unrelated internal id field, and sends the commission rate as a 0-1 fraction', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: {
        status: 'success',
        message: 'Subaccount created',
        data: {
          id: 2181, // Flutterwave's own internal row id - must NOT be what this function returns
          account_number: '0690000037',
          account_bank: '044',
          split_type: 'percentage',
          split_value: 0,
          subaccount_id: 'RS_235E8F4E92A4048B57EA29B0E1B8F78B',
          bank_name: 'ACCESS BANK NIGERIA',
        },
      },
    });

    const result = await createSubaccount(params);

    expect(result).toEqual({ subaccountId: 'RS_235E8F4E92A4048B57EA29B0E1B8F78B' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.split_type).toBe('percentage');
    expect(body.split_value).toBe(0); // PLATFORM_COMMISSION_PCT (0) / 100
    expect(body.country).toBe('NG');
    expect(body.account_number).toBe('0690000037');
  });

  it('returns null if the response is missing subaccount_id (a malformed/unexpected success payload)', async () => {
    mockFetchOnce({ ok: true, json: { status: 'success', data: { id: 2181 } } });
    await expect(createSubaccount(params)).resolves.toBeNull();
  });

  it('returns null on a rejected request rather than throwing', async () => {
    mockFetchOnce({ ok: false, status: 400, json: { status: 'error', message: 'Invalid account' } });
    await expect(createSubaccount(params)).resolves.toBeNull();
  });
});

describe('initializeSplitTransaction', () => {
  it('sends the split to the right subaccount and returns the hosted checkout link', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: { status: 'success', data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/abc123' } },
    });

    const result = await initializeSplitTransaction({
      subaccountId: 'RS_235E8F4E92A4048B57EA29B0E1B8F78B',
      email: 'customer@example.com',
      amountNaira: 5000,
      txRef: 'chat_11111111-1111-1111-1111-111111111111_abcd1234',
      bookingId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result).toEqual({ checkoutUrl: 'https://checkout.flutterwave.com/v3/hosted/pay/abc123' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subaccounts).toEqual([{ id: 'RS_235E8F4E92A4048B57EA29B0E1B8F78B' }]);
    expect(body.amount).toBe('5000');
    expect(body.currency).toBe('NGN');
    expect(body.tx_ref).toBe('chat_11111111-1111-1111-1111-111111111111_abcd1234');
  });

  it('returns null when Flutterwave declines to start checkout', async () => {
    mockFetchOnce({ ok: true, json: { status: 'error', message: 'Invalid subaccount' } });
    await expect(
      initializeSplitTransaction({
        subaccountId: 'RS_bad',
        email: 'a@b.com',
        amountNaira: 1000,
        txRef: 'chat_x_y',
        bookingId: 'x',
      })
    ).resolves.toBeNull();
  });
});

describe('verifyTransaction', () => {
  it('reports a plain Naira amount - never kobo math, unlike the Paystack version this replaced', async () => {
    mockFetchOnce({
      ok: true,
      json: { status: 'success', data: { status: 'successful', amount: 5000, currency: 'NGN' } },
    });

    const result = await verifyTransaction('chat_abc_123');
    expect(result).toEqual({ status: 'successful', amountNaira: 5000, currency: 'NGN' });
  });

  it('surfaces a failed transaction’s real status rather than treating it as a network error', async () => {
    mockFetchOnce({
      ok: true,
      json: { status: 'success', data: { status: 'failed', amount: 5000, currency: 'NGN' } },
    });

    const result = await verifyTransaction('chat_abc_123');
    expect(result?.status).toBe('failed');
  });

  it('returns null when the reference does not resolve to a real transaction', async () => {
    mockFetchOnce({ ok: false, status: 400, json: { status: 'error', message: 'No transaction was found' } });
    await expect(verifyTransaction('made-up-ref')).resolves.toBeNull();
  });

  it('URL-encodes the reference rather than interpolating it raw (a raw "&" would smuggle in a second query param)', async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: { status: 'success', data: { status: 'successful', amount: 1, currency: 'NGN' } } });
    await verifyTransaction('chat_x&y=z');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent('chat_x&y=z')}`);
  });
});
