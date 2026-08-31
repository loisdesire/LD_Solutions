import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/emailTemplate';
import { buildWeeklyDigestRows, getWeeklyDigestRecipients } from '@/lib/weeklyInsightsDigest';
import { SITE_URL } from '@/lib/site';

const BATCH_SIZE = 5; // concurrent sends - bounded so a large recipient list doesn't all hit Resend at once

// GET /api/cron/weekly-insights - triggered by Vercel Cron (see
// vercel.json), same auth pattern as /api/cron/send-reminders. Sends
// every Business Intelligence business's owner a real-numbers recap of
// their week - see lib/weeklyInsightsDigest.ts for what's in it and why
// it's computed rather than AI-generated per send.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const recipients = await getWeeklyDigestRecipients();
  const results: { businessId: string; sent: boolean }[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (r) => {
        try {
          const rows = await buildWeeklyDigestRows(r.businessId);
          const sent = await sendEmail(
            {
              to: r.ownerEmail,
              subject: `Your week at ${r.businessName}`,
              html: renderEmail({
                businessName: r.businessName,
                accentColor: r.accentColor,
                logoUrl: r.logoUrl,
                preheader: `Your weekly recap from ${r.businessName}`,
                heading: 'Your week, at a glance',
                intro: `Here's how the last 7 days went at ${r.businessName}.`,
                rows,
                cta: { label: 'Open your dashboard', url: `${SITE_URL}/${r.slug}/admin` },
                footerNote: 'Sent weekly as part of your Business Intelligence plan.',
              }),
            },
            'cron/weekly-insights',
            { businessId: r.businessId }
          );
          return { businessId: r.businessId, sent };
        } catch (err) {
          logError('cron/weekly-insights:business', err, { businessId: r.businessId });
          return { businessId: r.businessId, sent: false };
        }
      })
    );
    results.push(...batchResults);
  }

  return NextResponse.json({
    recipientCount: recipients.length,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent).length,
  });
}
