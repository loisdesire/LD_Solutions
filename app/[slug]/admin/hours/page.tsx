import { requireStaffSession } from '@/lib/requireStaffSession';
import AdminNav from '@/components/AdminNav';
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
    <main className="min-h-screen bg-canvas bg-grid">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 animate-rise">
        <AdminNav slug={slug} />

        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Working hours
          </h1>
          <p className="text-muted mt-3">
            When customers can book an appointment, by day of the week.
          </p>
        </header>

        <HoursManager businessId={business.id} initialAvailability={availability ?? []} />
      </div>
    </main>
  );
}
