import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/emailTemplate';
import { SITE_URL } from '@/lib/site';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/staff/notify-invite - sends the staff invite email.
//
// This route previously took `email`, `businessName` and `inviteUrl`
// straight from the request body with no authentication and no rate
// limit. That made it an open email relay on our own Resend account:
// anyone on the internet could send mail to any address, with an
// attacker-chosen subject and an attacker-chosen link behind
// "Accept your invite". Both values were interpolated raw into the HTML,
// so arbitrary markup could be injected too. Beyond the phishing risk,
// it would have burned the sending quota and put the domain's reputation
// at risk.
//
// Now the client sends only a slug and an invite token. Everything that
// reaches the email - recipient, business name, link - is looked up
// server-side from the invite row, so none of it is caller-controlled.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`invite-email:${getClientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, token } = await req.json();
  if (!slug || !token) return NextResponse.json({ error: 'Missing slug or token' }, { status: 400 });

  // Only someone already on this business's staff can trigger an invite email.
  const auth = await requireStaffApiSession(req, slug, 'id, name, accent_color, logo_url', { requireOwner: true });
  if (auth.error) return auth.error;
  const { business } = auth;

  // The invite must belong to the business the caller is authenticated
  // for, so a valid session cannot be used to mail out another
  // business's invites.
  const { data: invite } = await supabaseAdmin
    .from('staff_invites')
    .select('email, accepted, business_id')
    .eq('token', token)
    .eq('business_id', business.id)
    .maybeSingle();

  if (!invite || invite.accepted) {
    return NextResponse.json({ error: 'That invite is invalid or already used' }, { status: 404 });
  }

  const inviteUrl = `${SITE_URL}/${encodeURIComponent(slug)}/accept-invite?token=${encodeURIComponent(token)}`;

  // sendEmail never throws on a rejected send (bad recipient, domain
  // issue, rate limit) - it logs the failure and resolves to `false`, by
  // design (see its own comment). This route used to discard that return
  // value entirely and respond `{ ok: true }` unconditionally, so a
  // silently-failed send looked identical to a real one: the client's
  // toast said "Invite sent" either way, with no server-side signal ever
  // reaching the owner that it hadn't actually gone anywhere.
  const sent = await sendEmail(
    {
      to: invite.email,
      subject: `You have been invited to join ${business.name}`,
      html: renderEmail({
        businessName: business.name,
        accentColor: business.accent_color,
        logoUrl: business.logo_url,
        preheader: `Join the team at ${business.name}`,
        heading: 'You have been invited',
        intro: `You have been invited to join ${business.name}. Accept below to set up your account and start managing bookings.`,
        cta: { label: 'Accept your invite', url: inviteUrl },
        footerNote: 'If you were not expecting this, you can safely ignore it.',
      }),
      fromName: business.name,
    },
    'api/staff/notify-invite',
    { businessId: business.id }
  );

  return NextResponse.json({ ok: true, emailSent: sent });
}
