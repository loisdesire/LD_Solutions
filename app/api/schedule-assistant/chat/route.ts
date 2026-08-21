import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { runRescheduleAgent } from '@/lib/rescheduleAgent';
import type { AgentMessage } from '@/lib/agentLoop';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

// POST /api/schedule-assistant/chat - the staff-only reschedule assistant.
// Not gated by plan (unlike Insights) - this automates something every
// plan can already do by hand from the Calendar page (move a booking,
// message the customer), it's operational, not an analytics upsell. Same
// "browser holds history, resends it each turn" shape as the insights
// chat - no cross-session persistence needed for a single staff member's
// dashboard conversation.
export async function POST(req: NextRequest) {
  if (!rateLimit(`schedule-assistant:${getClientIp(req)}`, 20, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, message, history } = await req.json();
  if (!slug || !message) return NextResponse.json({ error: 'Missing slug or message' }, { status: 400 });

  const auth = await requireStaffApiSession(slug, 'id, name');
  if (auth.error) return auth.error;
  const { business } = auth;

  try {
    const reply = await runRescheduleAgent({
      businessId: business.id,
      businessName: business.name,
      history: Array.isArray(history) ? (history as AgentMessage[]).slice(-20) : [],
      message: String(message).slice(0, 2000),
    });
    return NextResponse.json({ reply });
  } catch (err) {
    logError('api/schedule-assistant/chat', err, { businessId: business.id });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
