import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';
import { notifyOwnerByEmail } from '@/lib/notifyOwnerOfChange';
import { verifyCronSecret } from '@/lib/verifyCronSecret';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TRIAL_WARNING_WINDOW_DAYS = 3;

// GET /api/cron/billing-warnings - triggered by Vercel Cron (see
// vercel.json), once daily. Two real gaps this closes: nothing ever told
// a business their trial was about to end before access actually cut off
// (the app only ever checks subscription state live, when a page loads,
// and redirects to Billing once it's ALREADY expired - reactive, not a
// warning), and nothing told them a payment had failed either, beyond
// that same after-the-fact lockout.
//
// trial_warning_sent_at / past_due_warning_sent_at (supabase/schema.sql)
// gate each business to exactly one warning per event, not a fresh one
// every day the condition still holds - past_due_warning_sent_at resets
// to null when a payment succeeds again (see the Flutterwave webhook's
// own comment), so a LATER failure still gets warned about.
export async function GET(req: NextRequest) {
  if (!(await verifyCronSecret(req, 'billing-warnings'))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const windowEnd = new Date(Date.now() + TRIAL_WARNING_WINDOW_DAYS * 86400_000).toISOString();

  const [trialResult, pastDueResult] = await Promise.all([
    supabaseAdmin
      .from('subscriptions')
      .select('id, business_id, trial_ends_at, businesses(name, slug)')
      .eq('status', 'trialing')
      .is('trial_warning_sent_at', null)
      .not('trial_ends_at', 'is', null)
      .lte('trial_ends_at', windowEnd)
      .gt('trial_ends_at', new Date().toISOString())
      .limit(100),
    supabaseAdmin
      .from('subscriptions')
      .select('id, business_id, businesses(name, slug)')
      .eq('status', 'past_due')
      .is('past_due_warning_sent_at', null)
      .limit(100),
  ]);

  if (trialResult.error) logError('cron/billing-warnings:trial-query', trialResult.error);
  if (pastDueResult.error) logError('cron/billing-warnings:past-due-query', pastDueResult.error);

  let trialWarned = 0;
  let pastDueWarned = 0;

  for (const row of trialResult.data ?? []) {
    const biz = (Array.isArray(row.businesses) ? row.businesses[0] : row.businesses) as { name: string; slug: string } | null;
    const daysLeft = Math.max(1, Math.ceil((new Date(row.trial_ends_at!).getTime() - Date.now()) / 86400_000));
    try {
      await notifyOwnerByEmail(row.business_id, {
        subject: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        heading: 'Your free trial is ending soon',
        intro: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Add a payment method to keep taking bookings without interruption.`,
        rows: [{ label: 'Trial ends', value: new Date(row.trial_ends_at!).toLocaleDateString('en-US', { dateStyle: 'long' }) }],
        footerNote: 'Nothing happens automatically if you do nothing - you just lose access to your dashboard and booking page once the trial ends.',
        logContext: 'cron/billing-warnings:trial-email',
      });
      await supabaseAdmin.from('subscriptions').update({ trial_warning_sent_at: new Date().toISOString() }).eq('id', row.id);
      trialWarned += 1;
    } catch (err) {
      logError('cron/billing-warnings:trial-send', err, { businessId: row.business_id, businessName: biz?.name });
    }
  }

  for (const row of pastDueResult.data ?? []) {
    try {
      await notifyOwnerByEmail(row.business_id, {
        subject: 'Your last payment failed',
        heading: 'Your last payment failed',
        intro: "We couldn't process your last payment. Your booking page and dashboard are paused until it's sorted out.",
        footerNote: 'Update your payment details from Billing to restore access.',
        logContext: 'cron/billing-warnings:past-due-email',
      });
      await supabaseAdmin.from('subscriptions').update({ past_due_warning_sent_at: new Date().toISOString() }).eq('id', row.id);
      pastDueWarned += 1;
    } catch (err) {
      logError('cron/billing-warnings:past-due-send', err, { businessId: row.business_id });
    }
  }

  return NextResponse.json({ trialWarned, pastDueWarned });
}
