import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The page-level counterpart to requireStaffApiSession (already fully
// covered) - every /[slug]/admin/* page runs through this first. Same
// authz boundary (cross-tenant staff check, requireOwner), plus one this
// route doesn't have: the subscription access gate, including the exact
// infinite-redirect bug this file's own comment documents as already
// having happened live (a business with no subscriptions row hit
// /admin/billing -> redirect to /admin/billing -> redirect... -
// ERR_TOO_MANY_REDIRECTS) - the x-pathname billing-page carve-out is what
// actually prevents that, and had no regression test until now.
//
// redirect()/notFound() are mocked to throw a distinguishable marker
// rather than relying on Next's real internal throw-and-catch machinery,
// which isn't meaningfully exercised outside an actual Next.js request
// lifecycle anyway - this only needs to prove requireStaffSession CALLS
// the right one with the right target, not that Next itself handles it.
class RedirectSignal extends Error {
  constructor(public path: string) {
    super(`REDIRECT:${path}`);
  }
}
class NotFoundSignal extends Error {
  constructor() {
    super('NOT_FOUND');
  }
}

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new RedirectSignal(path);
  },
  notFound: () => {
    throw new NotFoundSignal();
  },
}));

let headersMap: Record<string, string> = {};
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => headersMap[name] ?? null }),
}));

const getBusinessBySlugMock = vi.fn();
vi.mock('./getBusinessBySlug', () => ({
  getBusinessBySlug: (...args: unknown[]) => getBusinessBySlugMock(...args),
}));

const getUserMock = vi.fn();
const staffMaybeSingle = vi.fn();
const subscriptionMaybeSingle = vi.fn();

vi.mock('./supabase-server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'staff') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: staffMaybeSingle }) }) }) };
      }
      if (table === 'subscriptions') {
        return { select: () => ({ eq: () => ({ maybeSingle: subscriptionMaybeSingle }) }) };
      }
      throw new Error(`test double doesn't expect a query against "${table}"`);
    },
  }),
}));

const { requireStaffSession } = await import('./requireStaffSession');
const { DEMO_VIEWER_AUTH_ID } = await import('./demo');

const REAL_BUSINESS = { id: 'biz-1', name: 'Glow Salon' };
const REAL_USER = { id: 'user-1' };
const OWNER_ROW = { id: 'staff-1', role: 'owner' };
const STAFF_ROW = { id: 'staff-2', role: 'staff' };
const ACTIVE_SUB = { status: 'active', trial_ends_at: null, current_period_end: null };
const EXPIRED_SUB = { status: 'expired', trial_ends_at: null, current_period_end: null };

async function redirectTarget(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    throw new Error('expected a redirect, but none happened');
  } catch (err) {
    if (err instanceof RedirectSignal) return err.path;
    throw err;
  }
}

beforeEach(() => {
  // resetAllMocks, not clearAllMocks - clearAllMocks wipes call history but
  // NOT a queued-and-unconsumed mockResolvedValueOnce, which then leaks
  // into the next test's first call instead of this test's intended one.
  // Confirmed the hard way while writing this file.
  vi.resetAllMocks();
  headersMap = {};
  getBusinessBySlugMock.mockResolvedValue({ business: REAL_BUSINESS });
  getUserMock.mockResolvedValue({ data: { user: REAL_USER } });
  staffMaybeSingle.mockResolvedValue({ data: OWNER_ROW });
  subscriptionMaybeSingle.mockResolvedValue({ data: ACTIVE_SUB });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requireStaffSession', () => {
  it('404s (not a generic error) when the slug matches no business - existence stays hidden, same as the API version', async () => {
    getBusinessBySlugMock.mockResolvedValueOnce(null);
    await expect(requireStaffSession('no-such-business')).rejects.toThrow(NotFoundSignal);
  });

  it('redirects to login when nobody is signed in', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    expect(await redirectTarget(requireStaffSession('glow-salon'))).toBe('/glow-salon/login');
  });

  it('redirects to login for a real, authenticated user with no staff row at THIS business - the cross-tenant boundary', async () => {
    staffMaybeSingle.mockResolvedValueOnce({ data: null });
    expect(await redirectTarget(requireStaffSession('glow-salon'))).toBe('/glow-salon/login');
  });

  it('requireOwner redirects a real staff member who is not the owner back to the dashboard', async () => {
    staffMaybeSingle.mockResolvedValueOnce({ data: STAFF_ROW });
    expect(await redirectTarget(requireStaffSession('glow-salon', { requireOwner: true }))).toBe('/glow-salon/admin');
  });

  it('requireOwner accepts the actual owner', async () => {
    staffMaybeSingle.mockResolvedValueOnce({ data: OWNER_ROW });
    const result = await requireStaffSession('glow-salon', { requireOwner: true });
    expect(result.staff).toEqual(OWNER_ROW);
  });

  it('redirects to billing (with the locked query param) when the subscription has no access', async () => {
    subscriptionMaybeSingle.mockResolvedValueOnce({ data: EXPIRED_SUB });
    expect(await redirectTarget(requireStaffSession('glow-salon'))).toBe('/glow-salon/admin/billing?locked=1');
  });

  it('does not even query the subscription when skipSubscriptionCheck is passed', async () => {
    await requireStaffSession('glow-salon', { skipSubscriptionCheck: true });
    expect(subscriptionMaybeSingle).not.toHaveBeenCalled();
  });

  it('never redirects a lapsed business away from the billing page itself - this is the exact infinite-redirect bug that already happened live', async () => {
    subscriptionMaybeSingle.mockResolvedValueOnce({ data: EXPIRED_SUB });
    headersMap['x-pathname'] = '/glow-salon/admin/billing';

    const result = await requireStaffSession('glow-salon');
    expect(result.business).toEqual(REAL_BUSINESS);
  });

  it('the billing-page carve-out also covers its own sub-paths, not just the exact path', async () => {
    subscriptionMaybeSingle.mockResolvedValueOnce({ data: EXPIRED_SUB });
    headersMap['x-pathname'] = '/glow-salon/admin/billing/history';

    const result = await requireStaffSession('glow-salon');
    expect(result.business).toEqual(REAL_BUSINESS);
  });

  it('a lapsed business landing on any OTHER admin page still gets redirected to billing, even with x-pathname present', async () => {
    subscriptionMaybeSingle.mockResolvedValueOnce({ data: EXPIRED_SUB });
    headersMap['x-pathname'] = '/glow-salon/admin/calendar';

    expect(await redirectTarget(requireStaffSession('glow-salon'))).toBe('/glow-salon/admin/billing?locked=1');
  });

  it('flags the fixed demo-viewer account as read-only, and a real user as not', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: DEMO_VIEWER_AUTH_ID } } });
    staffMaybeSingle.mockResolvedValueOnce({ data: STAFF_ROW });
    const demoResult = await requireStaffSession('glow-salon');
    expect(demoResult.isDemoReadOnly).toBe(true);

    const realResult = await requireStaffSession('glow-salon');
    expect(realResult.isDemoReadOnly).toBe(false);
  });
});
