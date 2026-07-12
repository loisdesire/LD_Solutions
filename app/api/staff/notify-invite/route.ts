import { NextRequest, NextResponse } from 'next/server';

// POST /api/staff/notify-invite — fires the invite email. Best-effort, same
// pattern as the booking confirmation email: if RESEND_API_KEY isn't set,
// this silently no-ops and the invite still works via its shareable link.
export async function POST(req: NextRequest) {
  const { email, businessName, inviteUrl } = await req.json();

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'bookings@yourplatform.com',
          to: email,
          subject: `You've been invited to join ${businessName}`,
          html: `<p>You've been invited to join <strong>${businessName}</strong> on the booking platform.</p><p><a href="${inviteUrl}">Accept your invite</a></p>`,
        }),
      });
    } catch {
      console.error('Invite email failed to send');
    }
  }

  return NextResponse.json({ ok: true });
}
