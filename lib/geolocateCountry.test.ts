import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./logger', () => ({ logError: vi.fn() }));
const { logError } = await import('./logger');
const { geolocateCountryCode, geolocateCountryCodeCached } = await import('./geolocateCountry');

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function successResponse(countryCode: string) {
  return { ok: true, json: async () => ({ status: 'success', countryCode }) };
}

describe('geolocateCountryCode', () => {
  it('never calls out for a missing, local, or unknown IP', async () => {
    expect(await geolocateCountryCode('')).toBeNull();
    expect(await geolocateCountryCode('unknown')).toBeNull();
    expect(await geolocateCountryCode('127.0.0.1')).toBeNull();
    expect(await geolocateCountryCode('::1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the resolved country code on a real success response', async () => {
    fetchMock.mockResolvedValueOnce(successResponse('CA'));
    expect(await geolocateCountryCode('1.2.3.4')).toBe('CA');
  });

  it('returns null when ip-api.com reports anything other than status: success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'fail', message: 'invalid query' }) });
    expect(await geolocateCountryCode('1.2.3.4')).toBeNull();
  });

  it('returns null on a non-ok HTTP response rather than throwing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    expect(await geolocateCountryCode('1.2.3.4')).toBeNull();
  });

  it('returns null and logs, never throwing, when the request itself fails (timeout, network error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timed out'));
    const result = await geolocateCountryCode('1.2.3.4');
    expect(result).toBeNull();
    expect(logError).toHaveBeenCalledWith('geolocateCountryCode', expect.any(Error), { ip: '1.2.3.4' });
  });
});

describe('geolocateCountryCodeCached', () => {
  it('caches a successful lookup - a second call for the same IP does not hit the network again', async () => {
    fetchMock.mockResolvedValueOnce(successResponse('US'));

    const first = await geolocateCountryCodeCached('5.5.5.5');
    const second = await geolocateCountryCodeCached('5.5.5.5');

    expect(first).toBe('US');
    expect(second).toBe('US');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches a null (failed/unresolved) lookup too - a real ip-api.com outage should not be retried on every pageview', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'));

    const first = await geolocateCountryCodeCached('6.6.6.6');
    const second = await geolocateCountryCodeCached('6.6.6.6');

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('looks up each distinct IP independently - the whole point is per-visitor pricing, not one shared answer', async () => {
    fetchMock.mockResolvedValueOnce(successResponse('GH')).mockResolvedValueOnce(successResponse('ZA'));

    const a = await geolocateCountryCodeCached('7.7.7.7');
    const b = await geolocateCountryCodeCached('8.8.8.8');

    expect(a).toBe('GH');
    expect(b).toBe('ZA');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes once the cache entry has expired, rather than serving a stale answer forever', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(successResponse('NG')).mockResolvedValueOnce(successResponse('GB'));

    const first = await geolocateCountryCodeCached('9.9.9.9');
    // Past the 6-hour TTL - set the clock forward directly rather than
    // advancing timers, so the module's own cleanup interval never fires
    // mid-test and this stays a pure "is the cached value still fresh"
    // check, not a test of the sweep mechanism.
    vi.setSystemTime(Date.now() + 7 * 3600_000);
    const second = await geolocateCountryCodeCached('9.9.9.9');

    expect(first).toBe('NG');
    expect(second).toBe('GB');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
