import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';
import { notifyStaffOfReminder } from '@/lib/pushNotify';
import { verifyCronSecret } from '@/lib/verifyCronSecret';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 10; // concurrent sends - bounded so a large backlog doesn't all hit the push provider at once

// GET /api/cron/send-owner-reminders - triggered by Vercel Cron (see
// vercel.json), every 15 minutes. Delivers "remind me to call the
// supplier tomorrow at 2pm"-style reminders the assistant created (see
// lib/manageTools.ts's apply_create_reminder) as a push notification once
// their remind_at has passed, then marks them sent so a reminder never
// fires twice - the same reminder_sent_at-gates-eligibility shape
// send-reminders already uses for booking reminders, just on this table.
//
// Push-only for now, no email fallback - unlike a booking reminder there's
// no customer contact info to fall back to here, and this whole feature
// only exists because push notifications (the PWA) already shipped. A
// business with nobody's notifications enabled just gets nothing; sent_at
// is still set regardless (see notifyStaffOfReminder's own comment on
// why retrying an unreachable business forever wouldn't help anyone).
export async function GET(req: NextRequest) {
  if (!(await verifyCronSecret(req, 'send-owner-reminders'))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { data: reminders, error } = await supabaseAdmin
    .from('owner_reminders')
    .select('id, business_id, message')
    .is('sent_at', null)
    .lte('remind_at', new Date().toISOString())
    .limit(100);

  if (error) {
    logError('cron/send-owner-reminders:query', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = reminders ?? [];
  let delivered = 0;
  let unreachable = 0;

  async function sendOne(reminder: NonNullable<typeof reminders>[number]) {
    const reached = await notifyStaffOfReminder(reminder.business_id, reminder.message);
    if (reached) delivered += 1;
    else unreachable += 1;
    // Marked sent either way - nobody having notifications enabled isn't
    // a transient failure that a retry would ever fix, unlike a booking
    // reminder's channel-not-connected case (which DOES leave
    // reminder_sent_at null, since that business might reconnect before
    // the appointment). Left unreachable in the response so it's at
    // least visible this ran and found nobody to tell.
    await supabaseAdmin.from('owner_reminders').update({ sent_at: new Date().toISOString() }).eq('id', reminder.id);
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await Promise.all(rows.slice(i, i + BATCH_SIZE).map(sendOne));
  }

  return NextResponse.json({ checked: rows.length, delivered, unreachable });
}
