import { requireStaffSession } from '@/lib/requireStaffSession';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import AdminDashboardBody from '@/components/AdminDashboardBody';
import { todayInTimezone, zonedTimeToUtc } from '@/lib/timezone';

// Server-side only: bookings contain customer PII, so this uses the service
// role key rather than opening a public RLS policy on the table.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Just "Dashboard" now, not "{name} - Dashboard" - the admin layout's
// title template already appends " - {name}" to whatever a child page
// sets, so including the name here too would have doubled it up into
// "Glow Salon - Dashboard - Glow Salon".
export const metadata: Metadata = { title: 'Dashboard' };

export default async function AdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { slug } = await params;
  const { from, to } = await searchParams;
  const { business } = await requireStaffSession(slug);

  // The page used to load every booking a business had ever taken, then
  // throw most of it away in the browser. That is fine at a few dozen and
  // painful at a few thousand, and it grows with every booking they take.
  //
  // Two bounded windows instead. `windowStart` reaches back far enough to
  // cover last week, which is the earliest data any stat on this page
  // needs, and everything upcoming comes along with it. The past list is
  // its own range, defaulting to the last 7 days.
  const BOOKING_COLUMNS =
    'id, customer_name, customer_phone, customer_email, customer_telegram_username, start_time, status, services(name, price, duration_minutes), staff(name)';

  const nowMs = Date.now();
  const pastFrom = from ? new Date(`${from}T00:00:00`) : new Date(nowMs - 7 * 86400000);
  const pastTo = to ? new Date(`${to}T23:59:59`) : new Date(nowMs);

  const [{ data: recent }, { data: pastRows }, { data: bookableServices }, { data: rules }, { count: hoursCount }] =
    await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .eq('business_id', business.id)
        .gte('start_time', new Date(nowMs - 14 * 86400000).toISOString())
        .order('start_time', { ascending: true }),
      supabaseAdmin
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .eq('business_id', business.id)
        .gte('start_time', pastFrom.toISOString())
        .lte('start_time', pastTo.toISOString())
        .order('start_time', { ascending: true }),
      // For the "New appointment" modal - staff picking a service to book a
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
      // Setup-checklist signal only - is there any default (staff_id null)
      // opening-hours row at all. head:true so this is a count, not a
      // row fetch; the dashboard only needs to know "set" vs "not set".
      supabaseAdmin
        .from('availability')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .is('staff_id', null),
    ]);

  // One list for the table, deduped: the two windows overlap by design, so
  // a booking from the last few days appears in both.
  const seen = new Set<string>();
  const all = [...(recent ?? []), ...(pastRows ?? [])]
    .filter((b: any) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    })
    // Each query returns sorted, but concatenating two sorted lists does
    // not. nextSlot takes the first upcoming row it finds, so order matters.
    .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
  const now = new Date();
  // "Today"/"this week" boundaries in the business's own timezone, not the
  // server's - otherwise a business in Lagos gets its stats flipping over
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


  return (
    <AdminDashboardBody
      slug={slug}
      businessName={business.name}
      businessId={business.id}
      logoUrl={business.logo_url}
      services={bookableServices ?? []}
      maxAdvanceDays={rules?.max_advance_days ?? 30}
      all={all}
      todayCount={todayCount}
      todayRevenue={todayRevenue}
      thisWeekCount={thisWeek.length}
      weekCountDelta={weekCountDelta}
      weekRevenue={weekRevenue}
      revenuePctDelta={revenuePctDelta}
      nextSlot={nextSlot}
      profileDone={Boolean(business.description?.trim() || business.logo_url)}
      servicesDone={(bookableServices?.length ?? 0) > 0}
      hoursDone={(hoursCount ?? 0) > 0}
      paymentDone={Boolean(business.paystack_public_key)}
    />
  );
}
