import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/getAvailableSlots';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// GET /api/availability?businessId=...&serviceId=...&date=2026-07-15
export async function GET(req: NextRequest) {
  if (!rateLimit(`availability:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const businessId = req.nextUrl.searchParams.get('businessId');
  const serviceId = req.nextUrl.searchParams.get('serviceId');
  const date = req.nextUrl.searchParams.get('date');

  if (!businessId || !serviceId || !date) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const slots = await getAvailableSlots(businessId, serviceId, date);
  return NextResponse.json({ slots });
}
