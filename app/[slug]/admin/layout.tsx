import { requireStaffSession } from '@/lib/requireStaffSession';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSubscriptionState } from '@/lib/subscription';
import { hasBusinessIntelligence } from '@/lib/subscription-server';
import { getAssistantHistory } from '@/lib/assistantHistory';
import AdminSidebar from '@/components/AdminSidebar';
import AdminMobileNav from '@/components/AdminMobileNav';
import PwaRegister from '@/components/PwaRegister';
import AdminAssistantWidget from '@/components/AdminAssistantWidget';
import { ToastProvider } from '@/components/Toast';
import type { Metadata, Viewport } from 'next';

// Private staff area - never indexed, regardless of what any individual
// admin page under here does or doesn't set.
//
// Only the Dashboard page ever set its own title (`${name} - Dashboard`).
// Every other admin page - Calendar, Customers, Services, Channels,
// Assistant, all of it - had no title of its own, so Next fell through to
// the ROOT layout's default: "Vanova | AI booking receptionist for
// appointment businesses" - the full marketing tagline, crowding the
// browser tab on every admin screen. A `template` here means any page
// that still doesn't set its own title now falls back to just the
// business name (`default`), and a page that does set one (e.g.
// "Calendar") renders as "Calendar - Glow Salon" instead of falling all
// the way back to the marketing title.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  const name = data?.business.name ?? 'Dashboard';
  return {
    title: { default: name, template: `%s - ${name}` },
    robots: { index: false, follow: false },
    // Installable dashboard (PWA) - manifest is per-business (own name,
    // own accent color, opens straight into /admin) via
    // app/api/manifest/[slug]/route.ts, not a single shared manifest.
    manifest: `/api/manifest/${slug}`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: name },
    icons: { apple: '/apple-touch-icon.png' },
  };
}

// Separate from `metadata` per Next's own convention (themeColor moved out
// of Metadata in Next 14) - per-business so the iOS status bar / Android
// task-switcher chrome around the installed app matches this business's
// own brand color, not a fixed platform default.
export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  return {
    themeColor: data?.business.accent_color || '#C74A1E',
    width: 'device-width',
    initialScale: 1,
  };
}

// One shared shell for every /[slug]/admin/* page: does the staff-session
// check once, renders the persistent sidebar (business identity, nav,
// account/sign-out), and lets each page just render its own content.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, user, staff, supabase, isDemoReadOnly } = await requireStaffSession(slug);

  // Nav status signals - cheap enough to run on every admin navigation
  // (all indexed single-row/count lookups), and this is the one place
  // shared by every admin page, so a business only ever computes this
  // once per navigation rather than each page inventing its own version.
  // Same three required-setup signals SetupChecklist uses on the
  // dashboard, so the sidebar dot and the dashboard checklist can never
  // disagree about whether setup is actually done. Also mirrored in
  // lib/onboardingProgress.ts for the first-time onboarding chat - keep
  // both in sync if this formula ever changes.
  const [{ data: bizExtra }, { count: servicesCount }, { count: hoursCount }, { data: sub }, analyticsEnabled, assistantHistory] =
    await Promise.all([
      supabase
        .from('businesses')
        .select('description, logo_url, telegram_bot_username, whatsapp_display_number, messenger_page_name')
        .eq('id', business.id)
        .maybeSingle(),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('active', true),
      supabase.from('availability').select('id', { count: 'exact', head: true }).eq('business_id', business.id).is('staff_id', null),
      supabase.from('subscriptions').select('status, trial_ends_at, current_period_end, plan').eq('business_id', business.id).maybeSingle(),
      // For AdminAssistantWidget below - computed once here (same as every
      // other nav-status signal above) rather than each page inventing its
      // own version.
      hasBusinessIntelligence(business.id),
      getAssistantHistory(business.id, staff.id, 'assistant'),
    ]);

  const setupIncomplete = !(
    Boolean(bizExtra?.description?.trim() || bizExtra?.logo_url) &&
    (servicesCount ?? 0) > 0 &&
    (hoursCount ?? 0) > 0
  );
  const channelsDisconnected = !bizExtra?.telegram_bot_username && !bizExtra?.whatsapp_display_number && !bizExtra?.messenger_page_name;
  const subState = getSubscriptionState(sub ?? null);
  const trialEndingSoon = subState.phase === 'trial' && (subState.trialDaysLeft ?? 99) <= 3;

  const navStatus = { setupIncomplete, channelsDisconnected, trialEndingSoon };

  return (
    <ToastProvider>
      <PwaRegister slug={slug} />
      {/* Everywhere, not just the dashboard - was AskAssistantBar, which
          only rendered on the dashboard homepage, meaning "ask the
          assistant" meant leaving whatever you were doing on Services or
          Calendar first. Same conversation either way (shares history with
          the full /admin/assistant page via assistantHistory above). */}
      <AdminAssistantWidget
        slug={slug}
        businessName={business.name}
        logoUrl={bizExtra?.logo_url ?? null}
        analyticsEnabled={analyticsEnabled}
        initialMessages={assistantHistory}
      />
      <div className="min-h-screen bg-warm-surface md:flex">
        <AdminSidebar
          slug={slug}
          businessName={business.name}
          businessType={business.business_type}
          logoUrl={bizExtra?.logo_url ?? null}
          userEmail={user.email ?? ''}
          role={staff.role ?? 'staff'}
          navStatus={navStatus}
        />
        <div className="flex-1 min-w-0 bg-paper md:bg-warm-surface">
          <AdminMobileNav
            slug={slug}
            businessName={business.name}
            logoUrl={bizExtra?.logo_url ?? null}
            navStatus={navStatus}
            role={staff.role ?? 'staff'}
          />
          {/* Told before they try, not just after - the actual blocking
              happens server-side (requireStaffApiSession + the DB trigger
              in supabase/schema.sql), this is just so hitting Save doesn't
              come as a surprise. Persistent across every admin page, since
              this shell wraps all of them. */}
          {isDemoReadOnly && (
            <div className="bg-accent-soft border-b border-line px-5 sm:px-8 lg:px-12 py-2.5 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" className="shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--accent)' }}>
                You&rsquo;re viewing a live demo. Look around freely - nothing you change here is saved.
              </p>
            </div>
          )}
          <main className="max-w-[1180px] px-5 sm:px-8 lg:px-12 py-7 sm:py-10">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
