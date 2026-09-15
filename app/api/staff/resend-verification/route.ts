import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit } from '@/lib/rateLimit';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/emailTemplate';
import { logError } from '@/lib/logger';
import { SITE_URL } from '@/lib/site';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/staff/resend-verification - re-sends the same verification
// email api/signup/route.ts sends on account creation, for whoever's
// currently signed in. The original is a one-shot with no way to get a
// second copy if it's missed, lands in spam, or the owner just wasn't
// looking - this is that second copy. Doesn't rotate email_verify_token:
// it isn't a credential (confirming it can't grant access to anything),
// just a "did this address receive it" check, so re-sending the same
// link is simpler and no less safe than issuing a new one.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { slug } = body;
  if (typeof slug !== 'string' || !slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const auth = await requireStaffApiSession(req, slug, 'id, name, accent_color, logo_url');
  if (auth.error) return auth.error;
  const { business, staff } = auth;

  // Rate-limited per staff member, not per IP - this is a signed-in
  // action, and the thing worth capping is one account mashing "resend"
  // (and burning Resend send quota), not shared-IP false positives.
  if (!(await rateLimit(`resend-verification:${staff.id}`, 3, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts, please wait a few minutes and try again' }, { status: 429 });
  }

  const { data: staffRow, error } = await supabaseAdmin
    .from('staff')
    .select('email, email_verified_at, email_verify_token')
    .eq('id', staff.id)
    .single();

  if (error || !staffRow) {
    return NextResponse.json({ error: 'Could not find your account' }, { status: 404 });
  }

  if (staffRow.email_verified_at) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const verifyUrl = `${SITE_URL}/${encodeURIComponent(slug)}/verify-email?token=${encodeURIComponent(staffRow.email_verify_token)}`;
  const sent = await sendEmail(
    {
      to: staffRow.email,
      subject: `Verify your email for ${business.name}`,
      html: renderEmail({
        businessName: business.name,
        accentColor: business.accent_color,
        logoUrl: business.logo_url,
        preheader: `Confirm ${staffRow.email} for your Vanova account`,
        heading: 'Verify your email',
        intro: `Confirm ${staffRow.email} is the right address so we can always reach you about bookings, payments, and your account.`,
        cta: { label: 'Verify email', url: verifyUrl },
        footerNote: "If you didn't request this, you can safely ignore it.",
      }),
      fromName: business.name,
    },
    'api/staff/resend-verification',
    { businessId: business.id }
  );

  if (!sent) {
    logError('api/staff/resend-verification', new Error('sendEmail returned false'), { businessId: business.id });
    return NextResponse.json({ error: "Couldn't send that email right now, please try again shortly" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}
