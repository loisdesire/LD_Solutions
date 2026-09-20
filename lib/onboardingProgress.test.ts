import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives both the onboarding chat's "you're all set" gate and the
// dashboard's own setup-checklist reminder - the file's own comment
// warns this is deliberately duplicated logic (not shared with
// app/[slug]/admin/layout.tsx's own setupIncomplete) specifically because
// "a business must never see 'you're all set!' here and a still-blinking
// 'needs attention' dot on the dashboard" - exactly the kind of two-
// copies-that-can-drift bug a test is good at catching early.
const businessQuery = vi.fn();
const servicesCountQuery = vi.fn();
const hoursCountQuery = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'businesses') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(businessQuery()) }) }) };
      if (table === 'services') return { select: () => ({ eq: () => ({ eq: () => Promise.resolve(servicesCountQuery()) }) }) };
      if (table === 'availability') return { select: () => ({ eq: () => ({ is: () => Promise.resolve(hoursCountQuery()) }) }) };
      throw new Error(`test double doesn't expect a query against "${table}"`);
    },
  }),
}));

const { getOnboardingProgress } = await import('./onboardingProgress');

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getOnboardingProgress', () => {
  it('reports nothing done for a completely fresh business', async () => {
    businessQuery.mockResolvedValueOnce({ data: { description: null, logo_url: null, cover_image_url: null } });
    servicesCountQuery.mockResolvedValueOnce({ count: 0 });
    hoursCountQuery.mockResolvedValueOnce({ count: 0 });

    const result = await getOnboardingProgress('biz-1', 'glow-salon');

    expect(result).toMatchObject({ profileDone: false, servicesDone: false, hoursDone: false, allDone: false });
  });

  it('profileDone is true with EITHER a logo or a description alone - deliberately not requiring both', async () => {
    businessQuery.mockResolvedValueOnce({ data: { description: null, logo_url: 'https://x/logo.png', cover_image_url: null } });
    servicesCountQuery.mockResolvedValueOnce({ count: 0 });
    hoursCountQuery.mockResolvedValueOnce({ count: 0 });

    const result = await getOnboardingProgress('biz-1', 'glow-salon');
    expect(result.profileDone).toBe(true);
    expect(result.hasLogo).toBe(true);
    expect(result.hasDescription).toBe(false);
  });

  it('a whitespace-only description does not count as a real description', async () => {
    businessQuery.mockResolvedValueOnce({ data: { description: '   ', logo_url: null, cover_image_url: null } });
    servicesCountQuery.mockResolvedValueOnce({ count: 0 });
    hoursCountQuery.mockResolvedValueOnce({ count: 0 });

    const result = await getOnboardingProgress('biz-1', 'glow-salon');
    expect(result.profileDone).toBe(false);
    expect(result.hasDescription).toBe(false);
  });

  it('allDone requires every one of the three signals, not a majority', async () => {
    const profile = { data: { description: 'Real description', logo_url: null, cover_image_url: null } };
    businessQuery.mockResolvedValue(profile);
    servicesCountQuery.mockResolvedValue({ count: 1 });

    hoursCountQuery.mockResolvedValueOnce({ count: 0 }); // hours still missing
    const result = await getOnboardingProgress('biz-1', 'glow-salon');
    expect(result.allDone).toBe(false);

    hoursCountQuery.mockResolvedValueOnce({ count: 3 });
    const result2 = await getOnboardingProgress('biz-1', 'glow-salon');
    expect(result2.allDone).toBe(true);
  });

  it('reports the real service/hours counts, not just done/not-done, for the "you’ve only added one" nudge', async () => {
    businessQuery.mockResolvedValueOnce({ data: { description: 'x', logo_url: null, cover_image_url: null } });
    servicesCountQuery.mockResolvedValueOnce({ count: 1 });
    hoursCountQuery.mockResolvedValueOnce({ count: 2 });

    const result = await getOnboardingProgress('biz-1', 'glow-salon');
    expect(result.servicesCount).toBe(1);
    expect(result.hoursCount).toBe(2);
  });

  it('degrades every signal to its safe default rather than throwing when the business row itself is missing', async () => {
    businessQuery.mockResolvedValueOnce({ data: null });
    servicesCountQuery.mockResolvedValueOnce({ count: null });
    hoursCountQuery.mockResolvedValueOnce({ count: null });

    const result = await getOnboardingProgress('biz-1', 'glow-salon');
    expect(result).toMatchObject({
      profileDone: false,
      servicesDone: false,
      hoursDone: false,
      allDone: false,
      hasLogo: false,
      hasDescription: false,
      hasCoverImage: false,
      servicesCount: 0,
      hoursCount: 0,
      slug: 'glow-salon',
    });
  });
});
