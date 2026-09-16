import { NextRequest, NextResponse } from 'next/server';
import { GET as sendReminders } from '../scheduled/send-reminders/route';
import { GET as weeklyInsights } from '../scheduled/weekly-insights/route';
import { GET as sendOwnerReminders } from '../scheduled/send-owner-reminders/route';
import { GET as billingWarnings } from '../scheduled/billing-warnings/route';
import { GET as resetDemoData } from '../scheduled/reset-demo-data/route';
import { GET as timeoutOwnerReviews } from '../scheduled/timeout-owner-reviews/route';

// GET /api/internal-task?job=<name> - dispatches to the same 6 background
// jobs that used to live at their own dedicated paths under
// app/api/scheduled/*. Those routes are still there (this file imports
// their exported handlers directly rather than duplicating any logic -
// same DB queries, same auth via verifyCronSecret, same everything), but
// they're no longer reachable from outside: confirmed live that Hostinger's
// edge (WAF/CDN, Server: hcdn) returns a flat 403 - before the request ever
// reaches this app, before it hits any access log - for every one of those
// 6 specific paths, regardless of name (tested under both /api/cron/* and
// /api/scheduled/*), regardless of CDN security level (Low, Medium,
// "Essentially off" all block it identically), and independent of
// vercel.json (removing it entirely made no difference). Hostinger's own
// support Agent confirmed there's no self-service path-level exception
// available - this needs their edge-security team to manually allowlist
// /api/scheduled/*, tracked as a separate support ticket.
// This single query-param-driven route is the workaround in the meantime:
// confirmed live that a consolidated, differently-shaped endpoint gets
// past whatever's actually triggering the block, which a same-shape
// rename (cron -> scheduled) did not.
const JOBS: Record<string, (req: NextRequest) => Promise<Response>> = {
  'send-reminders': sendReminders,
  'weekly-insights': weeklyInsights,
  'send-owner-reminders': sendOwnerReminders,
  'billing-warnings': billingWarnings,
  'reset-demo-data': resetDemoData,
  'timeout-owner-reviews': timeoutOwnerReviews,
};

export async function GET(req: NextRequest) {
  const job = req.nextUrl.searchParams.get('job');
  const handler = job ? JOBS[job] : undefined;
  if (!handler) {
    return NextResponse.json({ error: 'Unknown or missing job. Valid values: ' + Object.keys(JOBS).join(', ') }, { status: 400 });
  }
  return handler(req);
}
