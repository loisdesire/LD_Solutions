import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';
import { verifyCronSecret } from '@/lib/verifyCronSecret';
import { parseContact } from '@/lib/contact';
import { getNotifyCreds } from '@/lib/notifyCustomer';
import { sendTelegramMessage, sendWhatsappMessage, sendMessengerMessage } from '@/lib/channelSend';
import { loadConversation, saveConversation, type ChatMessage } from '@/lib/whatsappTools';
import { MAX_HISTORY } from '@/lib/whatsappAgent';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A pending owner_reviews row (lib/whatsappTools.ts's requestOwnerReview)
// left waiting past this age gets an honest fallback instead of silence -
// the whole point of building a timeout at all was that "the human never
// answers" is a real, designed-for failure mode, not an edge case to
// ignore.
const STALE_AFTER_MS = 60 * 60_000; // 1 hour

// Daily, not every 15-60 minutes as the mechanism's own design intends -
// same real constraint already documented on send-owner-reminders/route.ts:
// Vercel's free Hobby tier only allows daily cron schedules. A review that
// goes stale shortly after this run last fired can sit unresolved for
// close to 24h before this catches it, same honest tradeoff already
// accepted elsewhere in this codebase. Tighten the schedule (vercel.json)
// once/if the account is actually on Pro - see the hosting note asking to
// confirm that before real volume shows up.
export async function GET(req: NextRequest) {
  if (!(await verifyCronSecret(req, 'timeout-owner-reviews'))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data: reviews, error } = await supabaseAdmin
    .from('owner_reviews')
    .select('id, business_id, customer_phone, customer_label')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(100);

  // Missing table (migration not run yet on this deployment) is expected
  // and silent, same PGRST205 pattern as every other not-yet-migrated
  // fallback in this codebase - not a real failure to log.
  if (error) {
    if (error.code !== 'PGRST205') logError('cron/timeout-owner-reviews:query', error);
    return NextResponse.json({ checked: 0, timedOut: 0 });
  }

  const rows = reviews ?? [];
  let timedOut = 0;

  for (const review of rows) {
    const { channel } = parseContact(review.customer_phone);
    const fallback =
      "Sorry for the wait - I wasn't able to reach the team on this one in time. Please try asking again, or " +
      'contact the business directly if it\'s urgent.';

    // 'direct' covers both a genuinely phone-only contact and a web-chat
    // visitor (see lib/contact.ts's own comment on why web: resolves to
    // 'direct') - neither has a channel this can push an unprompted
    // message through, same real gap /api/admin/message-customer already
    // has for these contacts. Still marked timed_out either way, so the
    // review stops showing as pending and the next real message that
    // customer sends gets a normal, un-stuck response instead of the AI
    // thinking a review is still open.
    if (channel !== 'direct') {
      const creds = await getNotifyCreds(review.business_id);
      const sendPromise =
        channel === 'whatsapp' && creds.whatsapp_access_token && creds.whatsapp_phone_number_id
          ? sendWhatsappMessage(creds.whatsapp_access_token, creds.whatsapp_phone_number_id, review.customer_phone, fallback)
          : channel === 'messenger' && creds.messenger_access_token
          ? sendMessengerMessage(creds.messenger_access_token, review.customer_phone.slice('messenger:'.length), fallback)
          : channel === 'telegram' && creds.telegram_bot_token
          ? sendTelegramMessage(creds.telegram_bot_token, review.customer_phone.slice('telegram:'.length), fallback)
          : Promise.resolve(false);

      const sent = await sendPromise;
      if (sent) {
        const history = await loadConversation(review.business_id, review.customer_phone);
        const newTurn: ChatMessage = { role: 'assistant', content: fallback };
        const updated = [...history, newTurn].slice(-MAX_HISTORY);
        await saveConversation(review.business_id, review.customer_phone, updated);
      }
    }

    await supabaseAdmin
      .from('owner_reviews')
      .update({ status: 'timed_out', resolved_at: new Date().toISOString() })
      .eq('id', review.id);
    timedOut += 1;
  }

  return NextResponse.json({ checked: rows.length, timedOut });
}
