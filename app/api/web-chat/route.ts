import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadConversation } from '@/lib/whatsappTools';
import { runWhatsappAgent } from '@/lib/whatsappAgent';
import { createCustomerServerSupabase } from '@/lib/supabase-server';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { cleanRequiredText, isUuid } from '@/lib/apiValidation';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A customer who messaged this business on Telegram/WhatsApp, then opens
// the website widget, used to start a completely fresh conversation - each
// channel is its own opaque identity, with nothing linking them. That's
// still true for an anonymous visitor (there's no way to safely verify who
// they are), but if this same person is logged into /account and opens the
// widget from a specific booking they already made, we genuinely know who
// they are: their authenticated session's email has to match that
// booking's own customer_email before this returns anything. Never trust a
// phone/identity the client just hands over directly - that would let
// anyone claim to be any customer and read their bookings; the server
// looks it up itself, from a booking only its true owner's session could
// pass the check for.
async function resolveIdentity(businessId: string, bookingId: string | null, sessionId: string | null) {
  if (bookingId) {
    const customerSupabase = await createCustomerServerSupabase();
    const {
      data: { user },
    } = await customerSupabase.auth.getUser();

    if (user?.email) {
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('customer_phone, customer_email, business_id')
        .eq('id', bookingId)
        .maybeSingle();

      if (booking && booking.business_id === businessId && booking.customer_email === user.email && booking.customer_phone) {
        return booking.customer_phone;
      }
    }
  }

  // Falls back to the anonymous per-visitor identity - either bookingId
  // wasn't given, or the ownership check above didn't pass.
  return sessionId ? `web:${sessionId}` : null;
}

// GET /api/web-chat?businessId=&sessionId=&bookingId= - hydrates the widget
// with existing history when a returning visitor reopens it, same
// conversation the AI already has from any earlier turns on this session.
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const bookingId = req.nextUrl.searchParams.get('bookingId');
  if (!isUuid(businessId) || (sessionId != null && !isUuid(sessionId)) || (bookingId != null && !isUuid(bookingId)) || (!sessionId && !bookingId)) {
    return NextResponse.json({ error: 'Invalid business, session, or booking' }, { status: 400 });
  }

  const identity = await resolveIdentity(businessId, bookingId, sessionId);
  if (!identity) return NextResponse.json({ messages: [] });

  const messages = await loadConversation(businessId, identity);
  return NextResponse.json({ messages });
}

// POST /api/web-chat - the website's own chat widget, talking to the exact
// same agent as WhatsApp/Telegram/Messenger (lib/whatsappAgent.ts doesn't
// know or care which channel called it). No provider webhook involved here
// at all: the browser calls this directly and gets the reply back in the
// same request, since there's no external messaging platform in the loop -
// `web:<sessionId>` is just this channel's version of the same opaque
// per-channel customer identifier the other channels already use, unless
// resolveIdentity above found a real, verified one to use instead.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`web-chat:${getClientIp(req)}`, 20, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many messages, please slow down.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { businessId, sessionId, bookingId, message } = body;
  const safeMessage = cleanRequiredText(message, 2000);
  if (!isUuid(businessId) || (sessionId != null && !isUuid(sessionId)) || (bookingId != null && !isUuid(bookingId)) || (!sessionId && !bookingId) || !safeMessage) {
    return NextResponse.json({ error: 'Invalid business, session, booking, or message' }, { status: 400 });
  }

  const identity = await resolveIdentity(businessId, typeof bookingId === 'string' ? bookingId : null, typeof sessionId === 'string' ? sessionId : null);
  if (!identity) {
    return NextResponse.json({ error: 'Missing businessId, sessionId, or message' }, { status: 400 });
  }

  try {
    const reply = await runWhatsappAgent({
      businessId,
      customerPhone: identity,
      incomingText: safeMessage,
    });
    return NextResponse.json({ reply });
  } catch (err) {
    logError('api/web-chat:agent', err, { businessId, sessionId, bookingId });
    return NextResponse.json(
      { reply: 'Sorry, something went wrong on our end. Please try again shortly.' },
      { status: 200 }
    );
  }
}
