import { createClient } from '@supabase/supabase-js';
import { requireStaffSession } from '@/lib/requireStaffSession';
import CalendarView from '@/components/CalendarView';
import { logError } from '@/lib/logger';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Calendar' };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business } = await requireStaffSession(slug);

  // Service role, not the session client - confirmed live: real, confirmed
  // bookings with fully valid service_id/staff_id foreign keys were
  // silently invisible on this page. The query itself and its RLS policy
  // both checked out fine in isolation; what didn't check out was this
  // exact shape - embedding services(name) AND staff(name) as joins under
  // the session client, which subjects the EMBEDDED tables' own RLS to
  // the same query, evaluated in a join context that behaves differently
  // than the same policies evaluated standalone (the one query on this
  // page's own Staff-page cousin that used no embed at all worked fine).
  // Authorization for this read is already fully handled by
  // requireStaffSession above - RLS here was pure defense-in-depth on top
  // of an already-gated query, not the only thing standing between this
  // data and an unauthorized reader, so reading via service role loses no
  // real protection. error is now actually read and logged too - it was
  // silently discarded before (`const { data } = await ...`), so a real
  // query failure rendered as a false, clean "nothing booked" empty state
  // with no trace anywhere that anything had gone wrong.
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, customer_name, customer_phone, customer_telegram_username, start_time, end_time, status, services(name), staff(name)'
    )
    .eq('business_id', business.id)
    .order('start_time', { ascending: true });

  if (error) logError('admin/calendar:bookings-query', error, { businessId: business.id });

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Today
        </div>
        <h1 className="font-display text-[26px] text-ink">Calendar</h1>
        <p className="text-ink-soft text-[13.5px] mt-1">Your schedule, week by week.</p>
      </div>

      <CalendarView slug={slug} timezone={business.timezone || 'UTC'} bookings={bookings ?? []} />
    </div>
  );
}
