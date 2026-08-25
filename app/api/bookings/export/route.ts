import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffApiSession } from '@/lib/requireStaffApiSession';
import { formatContactForExport } from '@/lib/contact';
import { statusLabel } from '@/lib/bookingStatus';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/bookings/export?slug=... - the full booking history as CSV.
//
// Export used to be built in the browser from whatever the dashboard had
// already loaded, which is why the dashboard had to load every booking a
// business had ever taken on every visit. Fetching it here means the page
// only loads what it displays, and the export still covers everything.
function csvCell(value: string | null | undefined): string {
  const v = value ?? '';
  // Quote if the value could break the row, and double any quotes inside.
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await requireStaffApiSession(req, slug, 'id');
  if (auth.error) return auth.error;

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select('customer_name, customer_email, customer_phone, customer_telegram_username, start_time, status, services(name)')
    .eq('business_id', auth.business.id)
    .order('start_time', { ascending: true });

  if (error) return NextResponse.json({ error: 'Could not build the export.' }, { status: 500 });

  const header = ['Customer', 'Email', 'Contact', 'When', 'Status', 'Service'];
  const lines = (bookings ?? []).map((b: any) =>
    [
      csvCell(b.customer_name),
      csvCell(b.customer_email),
      csvCell(formatContactForExport(b.customer_phone, b.customer_telegram_username)),
      csvCell(b.start_time),
      csvCell(statusLabel(b.status)),
      csvCell(b.services?.name ?? null),
    ].join(',')
  );

  return new NextResponse([header.join(','), ...lines].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-bookings.csv"`,
    },
  });
}
