import { NextRequest, NextResponse } from 'next/server';

// Throwaway diagnostic route - NOT wired to any real job logic yet. Testing
// whether a single query-param-driven endpoint (as opposed to 6 dedicated
// single-purpose GET routes) gets past whatever is blocking /api/scheduled/*
// at Hostinger's edge (see that directory's routes - confirmed via curl and
// Hostinger's own support Agent that this is an edge/WAF block, not an app
// or DNS issue, and self-service CDN controls don't affect it). If this
// passes, the real 6 jobs get wired in here for real; if it also gets
// blocked, that rules out route "shape" as the trigger entirely.
export async function GET(req: NextRequest) {
  const job = req.nextUrl.searchParams.get('job') ?? 'none';
  return NextResponse.json({ ok: true, job });
}
