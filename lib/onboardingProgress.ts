import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type OnboardingProgress = {
  // Kept exactly as before - "either one is enough" - for the chip/allDone
  // gate that unlocks the chat's own "you're all set" banner. Deliberately
  // NOT tightened to require both logo and description: that gate is about
  // "have they engaged with this section", not "is it perfectly complete",
  // and the new checklist below must never be able to trap someone here -
  // they can always finish and go to their dashboard, an outstanding
  // essential item just follows them there as a reminder instead of
  // blocking the door.
  profileDone: boolean;
  servicesDone: boolean;
  hoursDone: boolean;
  allDone: boolean;
  slug: string;
  // Granular profile signals, separate from profileDone above - the
  // checklist/reminder logic in onboardingAgent.ts and the dashboard
  // reminder banner both need to know SPECIFICALLY which of logo/
  // description/cover photo is still missing, not just "profile has at
  // least one of them". hasCoverImage already existed for the old
  // "optional extras" round; hasLogo/hasDescription are new, now that
  // logo and description are each tracked (and, per the owner's own
  // instruction, treated as essential) individually rather than as one
  // combined either/or signal.
  hasLogo: boolean;
  hasDescription: boolean;
  hasCoverImage: boolean;
  // Real counts, not just done/not-done - the section-transition nudge
  // needs to say "you've only added one service" specifically, not just
  // know that the minimum was met.
  servicesCount: number;
  hoursCount: number;
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
    supabaseAdmin.from('businesses').select('description, logo_url, cover_image_url').eq('id', businessId).maybeSingle(),
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
    hasLogo: Boolean(business?.logo_url),
    hasDescription: Boolean(business?.description?.trim()),
    hasCoverImage: Boolean(business?.cover_image_url),
    servicesCount: servicesCount ?? 0,
    hoursCount: hoursCount ?? 0,
  };
}
