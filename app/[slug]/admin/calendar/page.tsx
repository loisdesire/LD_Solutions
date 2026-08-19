import { requireStaffSession } from '@/lib/requireStaffSession';
import CalendarView from '@/components/CalendarView';

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, customer_name, customer_phone, customer_telegram_username, start_time, end_time, status, services(name), staff(name)'
    )
    .eq('business_id', business.id)
    .order('start_time', { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage
        </div>
        <h1 className="font-display text-[26px] text-ink">Calendar</h1>
        <p className="text-ink-soft text-[13.5px] mt-1">Your schedule, week by week.</p>
      </div>

      <CalendarView slug={slug} timezone={business.timezone || 'UTC'} bookings={bookings ?? []} />
    </div>
  );
}
