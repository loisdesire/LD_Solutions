import { requireStaffSession } from '@/lib/requireStaffSession';
import HoursManager from '@/components/HoursManager';

export default async function HoursPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const { data: availability } = await supabase
    .from('availability')
    .select('day_of_week, start_time, end_time')
    .eq('business_id', business.id)
    .is('staff_id', null);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage
        </div>
        <h1 className="font-display text-[26px] text-ink">Opening hours</h1>
        <p className="text-ink-soft text-[13.5px] mt-1">
          Slots only show for times you're open.
        </p>
      </div>

      <HoursManager businessId={business.id} initialAvailability={availability ?? []} />
    </div>
  );
}
