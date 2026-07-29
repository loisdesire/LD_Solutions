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

  // 3. Create the business, tied to that owner
  const { data: business, error: bizError } = await supabaseAdmin
    .from('businesses')
    .insert({
      slug,
      name: businessName,
      owner_auth_id: authUser.user.id,
    })
    .select()
    .single();

  if (bizError) {
    logError('api/signup:business-insert', bizError, { slug });
    return NextResponse.json({ error: bizError.message }, { status: 400 });
  }

  // 4. Create the owner's staff row, tagged to this business
  await supabaseAdmin.from('staff').insert({
    business_id: business.id,
    auth_id: authUser.user.id,
    name: businessName,
    email: ownerEmail,
    role: 'owner',
  });

  // 5. Default booking rules so the business works out of the box
  await supabaseAdmin.from('booking_rules').insert({
    business_id: business.id,
  });

  // 6. Start their 14-day trial — this is what the access gate
  // (requireStaffSession) checks to decide whether they're let into the
  // admin area, so every business needs one of these from day one.
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await supabaseAdmin.from('subscriptions').insert({
    business_id: business.id,
    status: 'trialing',
    trial_ends_at: trialEndsAt.toISOString(),
  });

  return NextResponse.json({ business });
}
