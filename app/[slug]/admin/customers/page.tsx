import { requireStaffSession } from '@/lib/requireStaffSession';
import CustomersManager from '@/components/CustomersManager';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Customers' };

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
  const { business, supabase } = await requireStaffSession(slug);

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'customer_name, customer_phone, customer_email, customer_telegram_username, start_time, status, services(name, price)'
    )
    .eq('business_id', business.id)
    .order('start_time', { ascending: true });

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
