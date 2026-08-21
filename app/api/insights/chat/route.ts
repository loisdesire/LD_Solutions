import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import { runInsightsAgent } from '@/lib/insightsAgent';
import type { AgentMessage } from '@/lib/agentLoop';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

// POST /api/insights/chat - the staff-only business-intelligence chat.
// Unlike the WhatsApp/Telegram agent, there's no cross-request conversation
// to persist server-side: the browser tab holds history in state and resends
// it each turn, since this is a single staff member in one dashboard session,
// not a multi-channel customer conversation that needs to survive across
// separate webhook calls.
export async function POST(req: NextRequest) {
  if (!rateLimit(`insights:${getClientIp(req)}`, 20, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, message, history } = await req.json();
  if (!slug || !message) return NextResponse.json({ error: 'Missing slug or message' }, { status: 400 });

  const auth = await requireStaffApiSession(slug, 'id, name');
  if (auth.error) return auth.error;
  const { business } = auth;

  if (!(await hasBusinessIntelligence(business.id))) {
    return NextResponse.json(
      { error: 'Business Intelligence isn\'t on your current plan. Upgrade in Billing to unlock this.' },
      { status: 403 }
    );
  }

  try {
    const reply = await runInsightsAgent({
      businessId: business.id,
      businessName: business.name,
      history: Array.isArray(history) ? (history as AgentMessage[]).slice(-20) : [],
      message: String(message).slice(0, 2000),
    });
    return NextResponse.json({ reply });
  } catch (err) {
    logError('api/insights/chat', err, { businessId: business.id });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
