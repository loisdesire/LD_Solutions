import { requireStaffSession } from '@/lib/requireStaffSession';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import AdminDashboardBody from '@/components/AdminDashboardBody';
import { formatContactForExport } from '@/lib/contact';
import { todayInTimezone, zonedTimeToUtc } from '@/lib/timezone';

// Server-side only: bookings contain customer PII, so this uses the service
// role key rather than opening a public RLS policy on the table.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  return { title: data ? `${data.business.name} — Dashboard` : 'Dashboard' };
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business } = await requireStaffSession(slug);

  const [{ data: bookings }, { data: bookableServices }, { data: rules }] =
    await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select(
          'id, customer_name, customer_phone, customer_email, customer_telegram_username, start_time, status, services(name, price, duration_minutes), staff(name)'
        )
        .eq('business_id', business.id)
        .order('start_time', { ascending: true }),
      // For the "New appointment" modal — staff picking a service to book a
      // walk-in/phone customer into, same set a customer would see.
      supabaseAdmin
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('business_id', business.id)
        .eq('active', true)
        .order('name'),
      supabaseAdmin
        .from('booking_rules')
        .select('max_advance_days')
        .eq('business_id', business.id)
        .maybeSingle(),
    ]);

  const all = bookings ?? [];
  const now = new Date();
  // "Today"/"this week" boundaries in the business's own timezone, not the
  // server's — otherwise a business in Lagos gets its stats flipping over
  // at server-local midnight (UTC on most hosts), miscounting bookings for
  // anyone within a few hours of that boundary.
  const timeZone = business.timezone || 'UTC';
  const startOfToday = zonedTimeToUtc(todayInTimezone(timeZone), '00:00', timeZone);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const startOfPrevWeek = new Date(startOfWeek);
  startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

  const active = all.filter((b) => b.status !== 'cancelled');
  const todayBookings = active.filter((b) => {
    const d = new Date(b.start_time);
    return d >= startOfToday && d < new Date(startOfToday.getTime() + 86400000);
  });
  const todayCount = todayBookings.length;
  const todayRevenue = todayBookings.reduce((sum, b: any) => sum + (b.services?.price ?? 0), 0);
  const thisWeek = active.filter((b) => {
    const d = new Date(b.start_time);
    return d >= startOfWeek && d < endOfWeek;
  });
  const prevWeek = active.filter((b) => {
    const d = new Date(b.start_time);
    return d >= startOfPrevWeek && d < startOfWeek;
  });
  const weekRevenue = thisWeek.reduce((sum, b: any) => sum + (b.services?.price ?? 0), 0);
  const prevWeekRevenue = prevWeek.reduce((sum, b: any) => sum + (b.services?.price ?? 0), 0);
  const weekCountDelta = thisWeek.length - prevWeek.length;
  const revenuePctDelta =
    prevWeekRevenue > 0 ? Math.round(((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100) : null;
  const nextSlot = active.find((b) => new Date(b.start_time) >= now);

  const exportRows = all.map((b: any) => ({
    customer_name: b.customer_name,
    customer_email: b.customer_email,
    customer_phone: formatContactForExport(b.customer_phone, b.customer_telegram_username),
    start_time: b.start_time,
    status: b.status,
    service_name: b.services?.name ?? null,
  }));

  return (
    <AdminDashboardBody
      slug={slug}
      businessId={business.id}
      services={bookableServices ?? []}
      maxAdvanceDays={rules?.max_advance_days ?? 30}
      exportRows={exportRows}
      all={all}
      todayCount={todayCount}
      todayRevenue={todayRevenue}
      thisWeekCount={thisWeek.length}
      weekCountDelta={weekCountDelta}
      weekRevenue={weekRevenue}
      revenuePctDelta={revenuePctDelta}
      nextSlot={nextSlot}
    />
  );
}
