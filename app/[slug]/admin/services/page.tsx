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

  const [{ data: services }, { data: bookings }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_minutes, price, active, category')
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

  const bookingStats = new Map<string, { count: number; revenue: number }>();
  for (const b of bookings ?? []) {
    if (!b.service_id) continue;
    const entry = bookingStats.get(b.service_id) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += (b.services as any)?.price ?? 0;
    bookingStats.set(b.service_id, entry);
  }

  const activeCount = (services ?? []).filter((s) => s.active).length;
  const hiddenCount = (services ?? []).length - activeCount;

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] text-ink mb-1.5">Service catalog</h1>
          <p className="text-ink-soft text-[14px]">What customers can book, and what it costs.</p>
        </div>
        {(services ?? []).length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="bg-surface px-4 py-2 rounded-xl border-2 border-line flex items-center gap-2">
              <span className="text-[12px] text-ink-faint">Active</span>
              <span className="text-[13.5px] font-semibold text-accent">{activeCount}</span>
            </div>
            {hiddenCount > 0 && (
              <div className="bg-surface px-4 py-2 rounded-xl border-2 border-line flex items-center gap-2">
                <span className="text-[12px] text-ink-faint">Hidden</span>
                <span className="text-[13.5px] font-semibold text-ink">{hiddenCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <ServicesManager
        businessId={business.id}
        initialServices={services ?? []}
        bookingStats={Object.fromEntries(bookingStats)}
      />
    </div>
  );
}
