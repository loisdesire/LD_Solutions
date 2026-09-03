import { createClient } from '@supabase/supabase-js';
import { requireStaffSession } from '@/lib/requireStaffSession';
import ServicesManager from '@/components/ServicesManager';
import { logError } from '@/lib/logger';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Services' };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const [servicesResult, bookingsResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_minutes, price, active, category, description, image_url')
      .eq('business_id', business.id)
      .order('name'),
    // Service role, not the session client - same real bug found on the
    // Calendar/Customers pages (see their own comments for the full
    // story): embedding services(price) as a join under the session
    // client made real, confirmed bookings silently invisible, which
    // quietly zeroed out the "most booked"/"highest revenue" stats below
    // rather than erroring. Authorization for this read is already fully
    // handled by requireStaffSession above.
    //
    // services!bookings_service_business_fk, not bare services() - a
    // second FK (bookings_service_business_fk, the pair-level constraint
    // added for tenant-consistency) means Postgres now has two valid
    // paths from bookings to services and refuses to guess which one an
    // unqualified embed means (PGRST201). Confirmed live: this was firing
    // on every single one of these queries, silently discarded before the
    // fix above started actually reading `error` - so the "fix" for the
    // invisible-bookings bug made the real failure loud without yet
    // curing it. Every bookings->services embed in the codebase has the
    // same two constraints and needs the same disambiguation.
    supabaseAdmin
      .from('bookings')
      .select('service_id, services!bookings_service_business_fk(price)')
      .eq('business_id', business.id)
      .neq('status', 'cancelled'),
  ]);
  const { data: bookings, error: bookingsError } = bookingsResult;
  if (bookingsError) logError('admin/services:bookings-query', bookingsError, { businessId: business.id });

  // 42703 = the services.description/image_url migration hasn't been run
  // against this database yet - a combined select fails as one unit on
  // ANY missing column, which would otherwise take the whole Services page
  // down rather than just leaving those two fields blank (see the same
  // pattern in lib/getBusinessBySlug.ts and lib/manageTools.ts).
  let services = servicesResult.data;
  if (servicesResult.error?.code === '42703') {
    const fallback = await supabase
      .from('services')
      .select('id, name, duration_minutes, price, active, category')
      .eq('business_id', business.id)
      .order('name');
    services = (fallback.data ?? []).map((s) => ({ ...s, description: null, image_url: null }));
  }

  const bookingStats = new Map<string, { count: number; revenue: number }>();
  for (const b of bookings ?? []) {
    if (!b.service_id) continue;
    const entry = bookingStats.get(b.service_id) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += (b.services as any)?.price ?? 0;
    bookingStats.set(b.service_id, entry);
  }

  return (
    <div>
      {/* Title, live stat pills, and "Add service" now all render inside
          ServicesManager itself, sharing one row - moved from here so the
          button (whose state already lives in that component) could sit
          on the same line as the heading instead of its own row below it. */}
      <ServicesManager
        slug={slug}
        businessId={business.id}
        initialServices={services ?? []}
        bookingStats={Object.fromEntries(bookingStats)}
      />
    </div>
  );
}
