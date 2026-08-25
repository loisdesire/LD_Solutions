import { NextRequest, NextResponse } from 'next/server';
import { getAvailabilityForRange } from '@/lib/getAvailableSlots';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// GET /api/availability/range?businessId=...&serviceId=...&start=2026-07-15&end=2026-08-25
// Answers "does this date have any open slot" for a whole visible
// calendar range in one call - what CalendarPicker needs to actually
// show which days are worth clicking, instead of every enabled date
// looking identically bookable. Separate route rather than an extra
// param on /api/availability: that one's shape (a flat slot-time array)
// doesn't fit a per-date answer, and this one's cost profile is
// different enough (a bounded multi-day computation vs. one day) to
// deserve its own rate-limit bucket rather than sharing the single-date
// one.
export async function GET(req: NextRequest) {
  if (!rateLimit(`availability-range:${getClientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const businessId = req.nextUrl.searchParams.get('businessId');
  const serviceId = req.nextUrl.searchParams.get('serviceId');
  const start = req.nextUrl.searchParams.get('start');
  const end = req.nextUrl.searchParams.get('end');

  if (!businessId || !serviceId || !start || !end) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const days = await getAvailabilityForRange(businessId, serviceId, start, end);
  return NextResponse.json({ days });
}
