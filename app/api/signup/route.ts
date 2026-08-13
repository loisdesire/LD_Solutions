import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

// Uses the service role key because this needs to create both an auth user
// and rows in businesses/staff — the anon key + RLS policies aren't meant
// to allow that from a public request.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  if (!rateLimit(`signup:${getClientIp(req)}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: 'Too many signup attempts, please try again later' }, { status: 429 });
  }

  const { businessName, slug, ownerEmail, ownerPassword } = await req.json();

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
  // actually succeeded) — a silent failure on the staff row specifically
  // left real accounts with a real business but no link between them:
  // login works, but "we couldn't find a business linked to this account"
  // forever. Now every step is checked, and a failure anywhere unwinds
  // whatever was already created instead of leaving a half-built account.
  try {
    // 3. Create the business, tied to that owner. accent_color is set
    // explicitly rather than left to the businesses table's column
    // default — that default is still the platform's old dark-navy
    // scheme (#0B1E33) from before the bright/airy redesign, and it isn't
    // one of the Settings page's own preset swatches, so a brand-new
    // business would open Settings and see no swatch selected despite
    // already having a real color. Setting it here means every new
    // business starts on-brand regardless of what the DB default says.
    const { data: business, error: bizError } = await supabaseAdmin
      .from('businesses')
      .insert({ slug, name: businessName, owner_auth_id: authUser.user.id, accent_color: '#FF6B4A' })
      .select()
      .single();

    if (bizError || !business) throw new Error(bizError?.message ?? 'Failed to create business');

    try {
      // 4. Create the owner's staff row, tagged to this business
      const { error: staffError } = await supabaseAdmin.from('staff').insert({
        business_id: business.id,
        auth_id: authUser.user.id,
        name: businessName,
        email: ownerEmail,
        role: 'owner',
      });
      if (staffError) throw new Error(`Failed to link account to business: ${staffError.message}`);

      // 5. Default booking rules so the business works out of the box
      const { error: rulesError } = await supabaseAdmin
        .from('booking_rules')
        .insert({ business_id: business.id });
      if (rulesError) throw new Error(`Failed to create booking rules: ${rulesError.message}`);

      // 6. Start their 14-day trial — this is what the access gate
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

    return NextResponse.json({ business });
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    logError('api/signup', err, { slug, ownerEmail });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Signup failed partway through. Please try again.' },
      { status: 500 }
    );
  }
}
