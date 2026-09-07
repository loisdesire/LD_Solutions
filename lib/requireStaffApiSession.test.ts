import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The real tenant-isolation/authz boundary an earlier audit flagged as
// untested ("Add route-level tests for cross-tenant and inactive-service
// rejection... database protection is implemented" but the app-level
// gate never was). This is that gate: every one of the ~13 API routes
// that write on a business's behalf calls requireStaffApiSession first,
// so a bug here is a bug in all of them at once - staff/owner
// authorization is the boundary between "any logged-in Vanova user" and
// "someone who actually belongs to THIS business", and requireOwner is
// the boundary between staff and owner-only actions (billing, settings,
// linking a payout account).
//
// Mocks two things: the service-role client (`supabaseAdmin`, module-
// level in the real file, only ever used to look up the business by
// slug) and createServerSupabase (the session-aware client, used for
// auth.getUser() and the staff lookup). Both are simple enough here to
// hand-roll rather than pull in a Supabase test-client library for two
// call shapes.
const businessesMaybeSingle = vi.fn();
const staffMaybeSingle = vi.fn();
const getUserMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'businesses') throw new Error(`test double doesn't expect a query against "${table}"`);
      return { select: () => ({ eq: () => ({ maybeSingle: businessesMaybeSingle }) }) };
    },
  }),
}));

vi.mock('./supabase-server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table !== 'staff') throw new Error(`test double doesn't expect a query against "${table}"`);
      return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: staffMaybeSingle }) }) }) };
    },
  }),
}));

const { requireStaffApiSession } = await import('./requireStaffApiSession');
const { DEMO_VIEWER_AUTH_ID } = await import('./demo');

const REAL_BUSINESS = { id: 'biz-1', name: 'Glow Salon' };
const REAL_USER = { id: 'user-1' };
const OWNER_ROW = { id: 'staff-1', role: 'owner' };
const STAFF_ROW = { id: 'staff-2', role: 'staff' };

function req(method: string = 'GET') {
  return new NextRequest('http://localhost/api/test', { method });
}

async function statusOf(result: { error?: Response }) {
  return result.error?.status;
}

beforeEach(() => {
  businessesMaybeSingle.mockReset();
  staffMaybeSingle.mockReset();
  getUserMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requireStaffApiSession', () => {
  it('404s when the slug matches no business - never leaks whether a slug exists via a different status', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: null });
    getUserMock.mockResolvedValue({ data: { user: REAL_USER } });

    const result = await requireStaffApiSession(req(), 'no-such-business');
    expect(await statusOf(result)).toBe(404);
  });

  it('401s an unauthenticated request even for a real business', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: REAL_BUSINESS });
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await requireStaffApiSession(req(), 'glow-salon');
    expect(await statusOf(result)).toBe(401);
  });

  it('403s a real, authenticated user who is not staff at THIS business - the actual cross-tenant boundary', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: REAL_BUSINESS });
    getUserMock.mockResolvedValue({ data: { user: REAL_USER } });
    staffMaybeSingle.mockResolvedValue({ data: null }); // authenticated, but no staff row for this business

    const result = await requireStaffApiSession(req(), 'glow-salon');
    expect(await statusOf(result)).toBe(403);
  });

  it('accepts a real staff member and hands back the business + staff row', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: REAL_BUSINESS });
    getUserMock.mockResolvedValue({ data: { user: REAL_USER } });
    staffMaybeSingle.mockResolvedValue({ data: STAFF_ROW });

    const result = await requireStaffApiSession(req(), 'glow-salon');
    expect(result.error).toBeUndefined();
    expect(result.business).toEqual(REAL_BUSINESS);
    expect(result.staff).toEqual(STAFF_ROW);
  });

  it('requireOwner: true 403s a real staff member who is not the owner', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: REAL_BUSINESS });
    getUserMock.mockResolvedValue({ data: { user: REAL_USER } });
    staffMaybeSingle.mockResolvedValue({ data: STAFF_ROW }); // role: 'staff'

    const result = await requireStaffApiSession(req(), 'glow-salon', 'id', { requireOwner: true });
    expect(await statusOf(result)).toBe(403);
  });

  it('requireOwner: true accepts the actual owner', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: REAL_BUSINESS });
    getUserMock.mockResolvedValue({ data: { user: REAL_USER } });
    staffMaybeSingle.mockResolvedValue({ data: OWNER_ROW });

    const result = await requireStaffApiSession(req(), 'glow-salon', 'id', { requireOwner: true });
    expect(result.error).toBeUndefined();
    expect(result.staff).toEqual(OWNER_ROW);
  });

  it('403s a non-GET request from the demo viewer account - the write-blocking half of the demo boundary', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: REAL_BUSINESS });
    getUserMock.mockResolvedValue({ data: { user: { id: DEMO_VIEWER_AUTH_ID } } });

    const result = await requireStaffApiSession(req('POST'), 'glow-salon');
    expect(await statusOf(result)).toBe(403);
    // Never even reaches the staff lookup - the demo account is rejected
    // before that query, not after finding out it happens to be staff.
    expect(staffMaybeSingle).not.toHaveBeenCalled();
  });

  it('allows a GET request from the demo viewer account through to the staff check', async () => {
    businessesMaybeSingle.mockResolvedValue({ data: REAL_BUSINESS });
    getUserMock.mockResolvedValue({ data: { user: { id: DEMO_VIEWER_AUTH_ID } } });
    staffMaybeSingle.mockResolvedValue({ data: STAFF_ROW });

    const result = await requireStaffApiSession(req('GET'), 'glow-salon');
    expect(result.error).toBeUndefined();
    expect(result.isDemoReadOnly).toBe(true);
  });
});
