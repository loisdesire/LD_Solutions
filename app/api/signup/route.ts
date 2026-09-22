import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { cleanEmail, cleanRequiredText, cleanSlug, isAcceptablePassword } from '@/lib/apiValidation';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/emailTemplate';
import { SITE_URL } from '@/lib/site';
import { geolocateCountryCode } from '@/lib/geolocateCountry';

// Uses the service role key because this needs to create both an auth user
// and rows in businesses/staff - the anon key + RLS policies aren't meant
// to allow that from a public request.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`signup:${getClientIp(req)}`, 5, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many signup attempts, please try again later' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const businessName = cleanRequiredText(body.businessName, 100);
  const slug = cleanSlug(body.slug);
  const ownerEmail = cleanEmail(body.ownerEmail, true);
  const ownerPassword = body.ownerPassword;
  if (!businessName || !slug || !ownerEmail || !isAcceptablePassword(ownerPassword)) {
    return NextResponse.json({ error: 'Please provide a valid business name, URL, email, and password' }, { status: 400 });
  }

  // Determined from the request itself, never asked - the owner's own
  // call: a cold "what country are you in" question on a signup form
  // nobody expects. Captured once, here, and never touched again - see
  // supabase/schema.sql's home_country_code comment for why this is a
  // separate column from businesses.country (which changes whenever a
  // payout bank account gets linked). A failed/unknown lookup defaults
  // to 'NG' (geolocateCountryCode's own safe fallback), same as before.
  const homeCountryCode = (await geolocateCountryCode(getClientIp(req))) ?? 'NG';

  // 1. Make sure the slug isn't already taken
  const { data: existing } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'That URL is already taken' }, { status: 400 });
  }

  // 2. Create the owner's auth account
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Signup failed' }, { status: 400 });
  }

  // Every step below used to be fire-and-forget (insert, ignore whether it
  // actually succeeded) - a silent failure on the staff row specifically
  // left real accounts with a real business but no link between them:
  // login works, but "we couldn't find a business linked to this account"
  // forever. Now every step is checked, and a failure anywhere unwinds
  // whatever was already created instead of leaving a half-built account.
  try {
    // 3. Create the business, tied to that owner. accent_color is set
    // explicitly rather than left to the businesses table's column
    // default (which lags behind whatever the platform's own identity
    // currently is, and isn't guaranteed to be one of the Settings
    // page's own preset swatches) - this is the platform's current
    // primary terracotta, kept in sync by hand whenever the brand changes.
    const { data: business, error: bizError } = await supabaseAdmin
      .from('businesses')
      .insert({
        slug,
        name: businessName,
        owner_auth_id: authUser.user.id,
        accent_color: '#C4512D',
        home_country_code: homeCountryCode,
      })
      .select()
      .single();

    if (bizError || !business) throw new Error(bizError?.message ?? 'Failed to create business');

    let staffRow: { id: string; email_verify_token: string } | null = null;
    try {
      // 4. Create the owner's staff row, tagged to this business.
      // .select() back for email_verify_token: email_confirm: true above
      // means Supabase already treats this address as confirmed (that's
      // what lets the sign-in right after this route succeed immediately),
      // but nothing ever actually verified the owner typed a real address
      // they control. This token is that separate, non-blocking check -
      // see the verification email sent below.
      const { data: newStaff, error: staffError } = await supabaseAdmin
        .from('staff')
        .insert({
          business_id: business.id,
          auth_id: authUser.user.id,
          name: businessName,
          email: ownerEmail,
          role: 'owner',
        })
        .select('id, email_verify_token')
        .single();
      if (staffError || !newStaff) throw new Error(`Failed to link account to business: ${staffError?.message ?? 'unknown error'}`);
      staffRow = newStaff;

      // 5. Default booking rules so the business works out of the box
      const { error: rulesError } = await supabaseAdmin
        .from('booking_rules')
        .insert({ business_id: business.id });
      if (rulesError) throw new Error(`Failed to create booking rules: ${rulesError.message}`);

      // 6. Start their 14-day trial - this is what the access gate
      // (requireStaffSession) checks to decide whether they're let into the
      // admin area, so every business needs one of these from day one.
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const { error: subError } = await supabaseAdmin.from('subscriptions').insert({
        business_id: business.id,
        status: 'trialing',
        trial_ends_at: trialEndsAt.toISOString(),
      });
      if (subError) throw new Error(`Failed to start trial: ${subError.message}`);
    } catch (err) {
      // business row cascades to staff/booking_rules/subscriptions on delete
      await supabaseAdmin.from('businesses').delete().eq('id', business.id);
      throw err;
    }

    // 7. Welcome + verification email, merged into one - deliberately
    // outside the rollback try above and never awaited-into-a-throw:
    // signup access isn't gated on this (see the schema comment on
    // staff.email_verified_at), so a Resend outage or a typo'd address
    // must never undo an otherwise-successful signup. Best-effort, logged
    // on failure, exactly like the staff invite email in
    // api/staff/notify-invite.
    //
    // This used to be a bare "Verify your email" notice - the ONLY email
    // this product sent a brand-new owner, with no actual welcome
    // anywhere in the signup flow. Merged rather than sent as a second,
    // separate email: two emails landing back-to-back right after signup
    // reads as spammier and does nothing the one email below can't do
    // itself (see the SPF/DKIM/DMARC conversation earlier this session -
    // deliverability is already a live concern, not a hypothetical one).
    if (staffRow) {
      try {
        const verifyUrl = `${SITE_URL}/${encodeURIComponent(slug)}/verify-email?token=${encodeURIComponent(staffRow.email_verify_token)}`;
        const bookingPageUrl = `${SITE_URL}/${slug}`;
        await sendEmail(
          {
            to: ownerEmail,
            subject: `${businessName} is live on Vanova`,
            html: renderEmail({
              businessName,
              accentColor: business.accent_color,
              logoUrl: business.logo_url,
              preheader: `Your booking page is ready - confirm ${ownerEmail} to finish setting up`,
              heading: `You're live, ${businessName}!`,
              intro:
                `Your booking page is ready right now - real customers can already find it and book.\n\n` +
                `One thing left: confirm ${ownerEmail} is the right address, so we can always reach you about bookings and payments. ` +
                `After that, head back to your setup chat to finish adding your services and hours if you haven't already.`,
              rows: [{ label: 'Your booking page', value: bookingPageUrl }],
              cta: { label: 'Verify email', url: verifyUrl },
              footerNote: "If you didn't create this account, you can safely ignore this email.",
            }),
            fromName: businessName,
          },
          'api/signup:welcome-email',
          { businessId: business.id }
        );
      } catch (err) {
        logError('api/signup:welcome-email', err, { businessId: business.id });
      }
    }

    return NextResponse.json({ business });
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    // This catch wraps the business/staff/booking_rules inserts, so `err`
    // here is a raw Postgres error, not a readable auth message like the
    // one at the top of this route. Logged above with full detail; the
    // signup page shows something a person can act on instead.
    logError('api/signup', err, { slug, ownerEmail });
    return NextResponse.json(
      { error: 'Signup failed partway through and has been rolled back. Please try again.' },
      { status: 500 }
    );
  }
}
