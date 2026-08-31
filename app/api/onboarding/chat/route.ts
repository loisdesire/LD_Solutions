import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { runOnboardingAgent } from '@/lib/onboardingAgent';
import { getOnboardingProgress } from '@/lib/onboardingProgress';
import type { AgentMessage } from '@/lib/agentLoop';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { appendAssistantMessages } from '@/lib/assistantHistory';
import { logError } from '@/lib/logger';

// POST /api/onboarding/chat - the first-time setup conversation
// (app/[slug]/onboarding). Owner-only (requireOwner: true) - a staff member
// invited later has nothing to onboard, the business already exists.
//
// Progress is recomputed fresh from the database on every single turn and
// handed to both the model (so its "what's still missing" understanding can
// never drift from reality across a long conversation) and back to the
// client (so the checklist banner updates the moment a tool call actually
// saves something, not just when the page next reloads).
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`onboarding:${getClientIp(req)}`, 20, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, message, history, imageUrl } = await req.json();
  if (!slug || !message) return NextResponse.json({ error: 'Missing slug or message' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id, name', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business, staff } = auth;

  // Same verification as app/api/assistant/chat/route.ts - only ever pass
  // the model a URL that's actually this app's own Storage bucket.
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

  const cleanMessage = String(message).slice(0, 2000);

  try {
    const progress = await getOnboardingProgress(business.id, slug);
    const reply = await runOnboardingAgent({
      businessId: business.id,
      businessName: business.name,
      history: Array.isArray(history) ? (history as AgentMessage[]).slice(-20) : [],
      message: cleanMessage,
      progress,
      imageUrl: safeImageUrl,
    });
    // Re-read after the agent's tool calls, if any, so what's returned
    // reflects what actually got saved this turn, not the state going in.
    const progressAfter = await getOnboardingProgress(business.id, slug);
    // So leaving mid-setup and coming back restores the conversation
    // instead of starting over - see lib/assistantHistory.ts. Awaited for
    // the same reason as app/api/assistant/chat/route.ts.
    await appendAssistantMessages(business.id, staff.id, 'onboarding', [
      { role: 'user', content: cleanMessage },
      { role: 'assistant', content: reply },
    ]);
    return NextResponse.json({ reply, progress: progressAfter });
  } catch (err) {
    logError('api/onboarding/chat', err, { businessId: business.id });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
