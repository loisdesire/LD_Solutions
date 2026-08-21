import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { runAssistantAgent } from '@/lib/assistantAgent';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import type { AgentMessage } from '@/lib/agentLoop';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

// POST /api/assistant/chat - the single staff-only assistant, replacing the
// separate insights and schedule-assistant endpoints.
//
// Not gated as a whole: rescheduling is something every plan can already do
// by hand from the Calendar page, so charging for it would be charging for
// convenience on work they can do anyway. The analytics half is the
// Business Intelligence feature, and that is decided per request below
// rather than by which URL the browser hit.
export async function POST(req: NextRequest) {
  if (!rateLimit(`assistant:${getClientIp(req)}`, 20, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, message, history } = await req.json();
  if (!slug || !message) return NextResponse.json({ error: 'Missing slug or message' }, { status: 400 });

  const auth = await requireStaffApiSession(slug, 'id, name');
  if (auth.error) return auth.error;
  const { business } = auth;

  try {
    const reply = await runAssistantAgent({
      businessId: business.id,
      businessName: business.name,
      history: Array.isArray(history) ? (history as AgentMessage[]).slice(-20) : [],
      message: String(message).slice(0, 2000),
      analyticsEnabled: await hasBusinessIntelligence(business.id),
    });
    return NextResponse.json({ reply });
  } catch (err) {
    logError('api/assistant/chat', err, { businessId: business.id });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
