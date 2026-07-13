import { requireStaffSession } from '@/lib/requireStaffSession';
import ServicesManager from '@/components/ServicesManager';

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price, active')
    .eq('business_id', business.id)
    .order('name');

  const activeCount = (services ?? []).filter((s) => s.active).length;
  const hiddenCount = (services ?? []).length - activeCount;

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage · Services
        </div>
        <h1 className="font-display text-[26px] text-ink">Services</h1>
        {(services ?? []).length > 0 && (
          <p className="font-mono text-[11px] text-ink-faint mt-1.5">
            {activeCount} active{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
          </p>
        )}
      </div>

      <ServicesManager businessId={business.id} initialServices={services ?? []} />
    </div>
  );
}
