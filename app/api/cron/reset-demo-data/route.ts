import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';
import { verifyCronSecret } from '@/lib/verifyCronSecret';
import { DEMO_SLUGS } from '@/lib/site';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Nightly refresh for every public chat-demo tenant (see DEMO_SLUGS in
// lib/site.ts). The real risk isn't the demo data going stale - it's that
// a real visitor can genuinely book a real slot through the real chat, and
// with enough of that over days/weeks every open hour on a demo calendar
// gets legitimately used up, leaving the next visitor nothing to book at
// all. This doesn't touch PAST bookings (harmless history that gives the
// dashboard/insights something real to show) - only wipes and refreshes
// what's still ahead of "now", which is the only part testers can
// actually exhaust.
//
// Deliberately doesn't hardcode which businesses or services exist -
// looks each demo business up by slug and reads its own real services, so
// adding a new demoSlug to DEMO_SLUGS is the only thing a future vertical
// needs to be covered by this job too.
const UPCOMING_OFFSETS_DAYS = [1, 2, 4, 6, 9];
const UPCOMING_HOURS = ['09:30', '10:00', '11:00', '13:00', '14:30'];

const REFRESH_CUSTOMERS = [
  { name: 'Demo Visitor', phone: '08000000001', email: 'demo.visitor1@example.com' },
  { name: 'Demo Visitor', phone: '08000000002', email: 'demo.visitor2@example.com' },
  { name: 'Demo Visitor', phone: '08000000003', email: 'demo.visitor3@example.com' },
  { name: 'Demo Visitor', phone: '08000000004', email: 'demo.visitor4@example.com' },
  { name: 'Demo Visitor', phone: '08000000005', email: 'demo.visitor5@example.com' },
];

function combineLocalToUtc(dateISO: string, hhmm: string, timezone: string): string {
  // Reuses the same fixed-offset assumption the original seed scripts
  // used for Africa/Lagos (UTC+1, no DST) - fine for the handful of demo
  // timezones this actually runs against; not a general TZ solution.
  const offsetHours = timezone === 'Africa/Lagos' ? 1 : 0;
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCHours(h - offsetHours, m, 0, 0);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  if (!(await verifyCronSecret(req, 'reset-demo-data'))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const results: Record<string, unknown> = {};

  for (const slug of DEMO_SLUGS) {
    try {
      const { data: business, error: bizError } = await supabaseAdmin
        .from('businesses')
        .select('id, timezone')
        .eq('slug', slug)
        .maybeSingle();
      if (bizError || !business) {
        results[slug] = { error: bizError?.message ?? 'business not found' };
        continue;
      }

      const { data: staffRow } = await supabaseAdmin
        .from('staff')
        .select('id')
        .eq('business_id', business.id)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

      const { data: services, error: svcError } = await supabaseAdmin
        .from('services')
        .select('id, name, duration_minutes')
        .eq('business_id', business.id)
        .eq('active', true);
      if (svcError || !services || services.length === 0) {
        results[slug] = { error: svcError?.message ?? 'no active services' };
        continue;
      }

      // Wipe everything from now onward - both what a visitor booked and
      // whatever this job itself inserted the previous night.
      const nowISO = new Date().toISOString();
      const { error: deleteError, count: deletedCount } = await supabaseAdmin
        .from('bookings')
        .delete({ count: 'exact' })
        .eq('business_id', business.id)
        .gte('start_time', nowISO);
      if (deleteError) {
        logError('cron/reset-demo-data:delete', deleteError, { slug });
        results[slug] = { error: deleteError.message };
        continue;
      }

      const today = new Date();
      const rows = UPCOMING_OFFSETS_DAYS.map((offset, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        const dateISO = date.toISOString().slice(0, 10);
        const service = services[i % services.length];
        const customer = REFRESH_CUSTOMERS[i % REFRESH_CUSTOMERS.length];
        const start = combineLocalToUtc(dateISO, UPCOMING_HOURS[i % UPCOMING_HOURS.length], business.timezone);
        const end = new Date(new Date(start).getTime() + service.duration_minutes * 60000).toISOString();
        return {
          business_id: business.id,
          service_id: service.id,
          staff_id: staffRow?.id ?? null,
          status: 'confirmed',
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email,
          start_time: start,
          end_time: end,
        };
      });

      const { error: insertError, data: inserted } = await supabaseAdmin
        .from('bookings')
        .insert(rows)
        .select('id');
      if (insertError) {
        logError('cron/reset-demo-data:insert', insertError, { slug });
        results[slug] = { error: insertError.message };
        continue;
      }

      results[slug] = { deleted: deletedCount ?? 0, inserted: inserted.length };
    } catch (err) {
      logError('cron/reset-demo-data', err, { slug });
      results[slug] = { error: 'unexpected failure' };
    }
  }

  return NextResponse.json({ ok: true, results });
}
