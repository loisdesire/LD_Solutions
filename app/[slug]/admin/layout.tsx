import { requireStaffSession } from '@/lib/requireStaffSession';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { getSubscriptionState } from '@/lib/subscription';
import AdminSidebar from '@/components/AdminSidebar';
import AdminMobileNav from '@/components/AdminMobileNav';
import { ToastProvider } from '@/components/Toast';
import type { Metadata } from 'next';

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
  const { business, user, staff, supabase } = await requireStaffSession(slug);

  // Nav status signals - cheap enough to run on every admin navigation
  // (all indexed single-row/count lookups), and this is the one place
  // shared by every admin page, so a business only ever computes this
  // once per navigation rather than each page inventing its own version.
  // Same three required-setup signals SetupChecklist uses on the
  // dashboard, so the sidebar dot and the dashboard checklist can never
  // disagree about whether setup is actually done.
  const [{ data: bizExtra }, { count: servicesCount }, { count: hoursCount }, { data: sub }] = await Promise.all([
    supabase
      .from('businesses')
      .select('description, logo_url, telegram_bot_username, whatsapp_display_number, messenger_page_name')
      .eq('id', business.id)
      .maybeSingle(),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('active', true),
    supabase.from('availability').select('id', { count: 'exact', head: true }).eq('business_id', business.id).is('staff_id', null),
    supabase.from('subscriptions').select('status, trial_ends_at, current_period_end, plan').eq('business_id', business.id).maybeSingle(),
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
          <main className="max-w-[1180px] px-5 sm:px-8 lg:px-12 py-7 sm:py-10">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
