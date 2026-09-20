import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyBusinessMediaUrl } from './verifyBusinessMediaUrl';

// This is the only thing standing between "a URL the assistant is told to
// treat as this business's own photo" and "any URL anyone puts in a
// request body" (see the function's own comment) - the assistant/
// onboarding chat endpoints take imageUrl as plain JSON, no upload step of
// their own to trust. Writing this test is what surfaced a real
// regression in the shipped version: endsWith('.supabase.co') alone
// accepts ANY Supabase project's host, not specifically this app's own -
// Supabase's free tier hands anyone their own project in minutes, so an
// attacker's own bucket (their host, their path, their businessId
// substring) passed the exact same check a legitimate URL would. Fixed to
// anchor against NEXT_PUBLIC_SUPABASE_URL's real hostname; these tests
// cover both the original documented threat model and that regression.
const OWN_URL = 'https://realproject.supabase.co';
const BUSINESS_ID = 'biz-123';
const REAL_URL = `${OWN_URL}/storage/v1/object/public/business-media/${BUSINESS_ID}/photo.jpg`;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = OWN_URL;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});

describe('verifyBusinessMediaUrl', () => {
  it('accepts a real URL on this project’s own host, in this business’s own media folder', () => {
    expect(verifyBusinessMediaUrl(REAL_URL, BUSINESS_ID)).toBe(REAL_URL);
  });

  it('rejects a URL hosted on a DIFFERENT Supabase project, even with the exact right business-media path - the regression this test suite exists to catch', () => {
    const attackerUrl = `https://attacker-project.supabase.co/storage/v1/object/public/business-media/${BUSINESS_ID}/evil.jpg`;
    expect(verifyBusinessMediaUrl(attackerUrl, BUSINESS_ID)).toBeNull();
  });

  it('rejects any plain external URL not on supabase.co at all', () => {
    expect(verifyBusinessMediaUrl('https://evil.example.com/photo.jpg', BUSINESS_ID)).toBeNull();
  });

  it('rejects a non-https URL, even http on the real host', () => {
    const httpUrl = REAL_URL.replace('https://', 'http://');
    expect(verifyBusinessMediaUrl(httpUrl, BUSINESS_ID)).toBeNull();
  });

  it('rejects a real-host URL that belongs to a DIFFERENT business’s media folder', () => {
    const otherBusinessUrl = `${OWN_URL}/storage/v1/object/public/business-media/some-other-business/photo.jpg`;
    expect(verifyBusinessMediaUrl(otherBusinessUrl, BUSINESS_ID)).toBeNull();
  });

  it('rejects a real-host URL that is not under business-media at all', () => {
    const wrongPath = `${OWN_URL}/storage/v1/object/public/some-other-bucket/${BUSINESS_ID}/photo.jpg`;
    expect(verifyBusinessMediaUrl(wrongPath, BUSINESS_ID)).toBeNull();
  });

  it('rejects a malformed URL rather than throwing', () => {
    expect(() => verifyBusinessMediaUrl('not a url at all', BUSINESS_ID)).not.toThrow();
    expect(verifyBusinessMediaUrl('not a url at all', BUSINESS_ID)).toBeNull();
  });

  it('rejects null, undefined, empty string, and non-string input', () => {
    expect(verifyBusinessMediaUrl(null, BUSINESS_ID)).toBeNull();
    expect(verifyBusinessMediaUrl(undefined, BUSINESS_ID)).toBeNull();
    expect(verifyBusinessMediaUrl('', BUSINESS_ID)).toBeNull();
    expect(verifyBusinessMediaUrl(12345, BUSINESS_ID)).toBeNull();
  });

  it('fails closed - never accepts anything - when NEXT_PUBLIC_SUPABASE_URL itself is unset', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(verifyBusinessMediaUrl(REAL_URL, BUSINESS_ID)).toBeNull();
  });

  it('a hostname that merely ends with the project host as a suffix (not an exact match) is rejected, not treated as a subdomain match', () => {
    const lookalike = `https://notrealproject.supabase.co/storage/v1/object/public/business-media/${BUSINESS_ID}/photo.jpg`;
    expect(verifyBusinessMediaUrl(lookalike, BUSINESS_ID)).toBeNull();
  });
});
