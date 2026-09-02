import { requireStaffSession } from '@/lib/requireStaffSession';
import ServicesManager from '@/components/ServicesManager';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Services' };

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const [servicesResult, { data: bookings }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_minutes, price, active, category, description, image_url')
      .eq('business_id', business.id)
      .order('name'),
    // Feeds the real "most booked" / "highest revenue" stats below -
    // computed from actual bookings, not the fixed numbers a mockup uses.
    supabase
      .from('bookings')
      .select('service_id, services(price)')
      .eq('business_id', business.id)
      .neq('status', 'cancelled'),
  ]);

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
