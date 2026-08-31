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
  if (!(await rateLimit(`assistant:${getClientIp(req)}`, 20, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, message, history, imageUrl } = await req.json();
  if (!slug || !message) return NextResponse.json({ error: 'Missing slug or message' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id, name');
  if (auth.error) return auth.error;
  const { business } = auth;

  // Verified here, not just trusted from the client - only ever pass the
  // model a URL that's actually this app's own Storage bucket, the exact
  // same check lib/manageTools.ts repeats before it will let a create/update
  // service call use one. Belt and braces: a bad value gets dropped silently
  // here rather than reaching the model as if it were a real photo.
  let safeImageUrl: string | null = null;
  if (typeof imageUrl === 'string' && imageUrl) {
    try {
      const url = new URL(imageUrl);
      const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
      if (url.host === supabaseHost && url.pathname.includes('/business-media/')) safeImageUrl = imageUrl;
    } catch {
      // leave safeImageUrl null
    }
  }

  try {
    const reply = await runAssistantAgent({
      businessId: business.id,
      businessName: business.name,
      history: Array.isArray(history) ? (history as AgentMessage[]).slice(-20) : [],
      message: String(message).slice(0, 2000),
      analyticsEnabled: await hasBusinessIntelligence(business.id),
      imageUrl: safeImageUrl,
    });
    return NextResponse.json({ reply });
  } catch (err) {
    logError('api/assistant/chat', err, { businessId: business.id });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
