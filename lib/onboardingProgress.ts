import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type OnboardingProgress = {
  profileDone: boolean;
  servicesDone: boolean;
  hoursDone: boolean;
  allDone: boolean;
  slug: string;
};

// Same three-signal formula as app/[slug]/admin/layout.tsx's
// setupIncomplete, deliberately NOT refactored to share code with it - that
// layout already does one combined query per navigation (services, hours,
// AND channel/subscription fields this doesn't need) using the caller's own
// RLS-scoped session client; calling this from there too would just add a
// second redundant round trip. If the definition of "set up enough" ever
// changes, change it in both places - a business must never see "you're all
// set!" here and a still-blinking "needs attention" dot on the dashboard.
// Kept as three separate booleans (not one combined flag) so the onboarding
// checklist can show which specific step is still open.
export async function getOnboardingProgress(businessId: string, slug: string): Promise<OnboardingProgress> {
  const [{ data: business }, { count: servicesCount }, { count: hoursCount }] = await Promise.all([
    supabaseAdmin.from('businesses').select('description, logo_url').eq('id', businessId).maybeSingle(),
    supabaseAdmin.from('services').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('active', true),
    supabaseAdmin.from('availability').select('id', { count: 'exact', head: true }).eq('business_id', businessId).is('staff_id', null),
  ]);

  const profileDone = Boolean(business?.description?.trim() || business?.logo_url);
  const servicesDone = (servicesCount ?? 0) > 0;
  const hoursDone = (hoursCount ?? 0) > 0;

  return {
    profileDone,
    servicesDone,
    hoursDone,
    allDone: profileDone && servicesDone && hoursDone,
    slug,
  };
}
