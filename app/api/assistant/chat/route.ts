import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { runAssistantAgent } from '@/lib/assistantAgent';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import type { AgentMessage } from '@/lib/agentLoop';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { appendAssistantMessages } from '@/lib/assistantHistory';
import { verifyBusinessMediaUrl } from '@/lib/verifyBusinessMediaUrl';
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
  if (!(await rateLimit(`assistant:${getClientIp(req)}`, 20, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, message, history, imageUrl } = await req.json();
  if (!slug || !message) return NextResponse.json({ error: 'Missing slug or message' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id, name');
  if (auth.error) return auth.error;
  const { business, staff } = auth;

  // Verified here, not just trusted from the client - only ever pass the
  // model a URL that's actually this business's own upload, the same
  // check lib/manageTools.ts's cleanImageUrl repeats before it will let a
  // create/update service call use one. Belt and braces: a bad value gets
  // dropped silently here rather than reaching the model as if it were a
  // real photo. See lib/verifyBusinessMediaUrl.ts.
  const safeImageUrl = verifyBusinessMediaUrl(imageUrl, business.id);

  const cleanMessage = String(message).slice(0, 2000);

  try {
    const reply = await runAssistantAgent({
      businessId: business.id,
      businessName: business.name,
      slug,
      history: Array.isArray(history) ? (history as AgentMessage[]).slice(-20) : [],
      message: cleanMessage,
      analyticsEnabled: await hasBusinessIntelligence(business.id),
      imageUrl: safeImageUrl,
    });
    // So leaving this page mid-conversation and coming back restores it -
    // see lib/assistantHistory.ts. Awaited, not fire-and-forget - a
    // serverless function can be frozen the instant it returns a response,
    // with no guarantee an un-awaited promise after that point ever
    // actually finishes. appendAssistantMessages never throws on its own
    // (it swallows and logs), so this can't turn a successful reply into a
    // failed request.
    await appendAssistantMessages(business.id, staff.id, 'assistant', [
      { role: 'user', content: cleanMessage },
      { role: 'assistant', content: reply },
    ]);
    return NextResponse.json({ reply });
  } catch (err) {
    logError('api/assistant/chat', err, { businessId: business.id });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
