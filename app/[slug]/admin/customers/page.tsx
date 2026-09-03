import { createClient } from '@supabase/supabase-js';
import { requireStaffSession } from '@/lib/requireStaffSession';
import CustomersManager from '@/components/CustomersManager';
import { logError } from '@/lib/logger';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Customers' };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// There's no separate customers table - every booking just carries its
// own customer_name/phone/email/telegram_username, since a customer
// never creates an account to book. This page is the one place that
// actually groups those rows back into "people," so a business owner
// can see who keeps coming back instead of only ever seeing bookings
// one at a time.
export default async function CustomersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business } = await requireStaffSession(slug);

  // Service role, not the session client - same real bug as the Calendar
  // page (see its own comment for the full story): real, confirmed
  // bookings with valid foreign keys went completely invisible here,
  // traced to embedding services(name, price) as a join under the
  // session client. Authorization for this read is already fully handled
  // by requireStaffSession above.
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'customer_name, customer_phone, customer_email, customer_telegram_username, start_time, status, services!bookings_service_business_fk(name, price)'
    )
    .eq('business_id', business.id)
    .order('start_time', { ascending: true });

  if (error) logError('admin/customers:bookings-query', error, { businessId: business.id });

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Today
        </div>
        <h1 className="font-display text-[26px] text-ink">Customers</h1>
        <p className="text-ink-soft text-[13.5px] mt-1">
          Everyone who's booked with {business.name}, built from their actual bookings.
        </p>
      </div>

      <CustomersManager slug={slug} bookings={bookings ?? []} />
    </div>
  );
}
