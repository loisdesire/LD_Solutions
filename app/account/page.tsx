import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { createCustomerServerSupabase } from '@/lib/supabase-server';
import AccountBookingCard from '@/components/AccountBookingCard';
import LogoutButton from '@/components/LogoutButton';
import EmptyState from '@/components/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My bookings',
  robots: { index: false, follow: false },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AccountPage() {
  const supabase = await createCustomerServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect('/account/login');

  // Service role: bookings aren't publicly readable, but we've already
  // verified the requester's identity via their authenticated session
  // above - matching by email is the whole point of this page, not a
  // bypass of it.
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, business_id, customer_phone, start_time, status, businesses(name, slug), services!bookings_service_business_fk(name, duration_minutes, price)'
    )
    .eq('customer_email', user.email)
    .order('start_time', { ascending: false });

  const rows = bookings ?? [];

  // Chat history is keyed by (business_id, customer_phone), not by
  // account/email - a customer might have chatted via a phone number tied
  // to one specific booking. Fetch every conversation for the pairs that
  // actually show up in their bookings, then match in memory.
  const pairs = [...new Set(rows.filter((b) => b.customer_phone).map((b) => `${b.business_id}::${b.customer_phone}`))];
  const businessIds = [...new Set(rows.map((b) => b.business_id))];

  const { data: conversations } = pairs.length
    ? await supabaseAdmin
        .from('whatsapp_conversations')
        .select('business_id, customer_phone, messages')
        .in('business_id', businessIds)
    : { data: [] };

  const conversationByPair = new Map(
    (conversations ?? [])
      .filter((c) => pairs.includes(`${c.business_id}::${c.customer_phone}`))
      .map((c) => [`${c.business_id}::${c.customer_phone}`, c.messages ?? []])
  );

  const now = Date.now();
  const upcoming = rows.filter((b) => b.status !== 'cancelled' && new Date(b.start_time).getTime() >= now);
  const past = rows.filter((b) => b.status === 'cancelled' || new Date(b.start_time).getTime() < now);

  return (
    <main className="min-h-screen bg-paper px-6 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-11 w-11 rounded-full text-accent-contrast flex items-center justify-center font-display text-[16px] font-bold shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              {user.email[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[20px] text-ink leading-tight">My bookings</h1>
              <p className="text-ink-faint text-[12.5px] truncate">
                {user.email}
                {rows.length > 0 && (
                  <>
                    {' · '}
                    {rows.length} {rows.length === 1 ? 'booking' : 'bookings'}
                  </>
                )}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>

        {rows.length === 0 ? (
          // Vanova isn't a directory of businesses to browse, so there's
          // no real "book again" catalog to point at - the honest
          // action here is explaining how a booking actually gets here,
          // not inventing a discovery flow that doesn't exist.
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            }
            title="Nothing here yet"
            description={`No bookings found for ${user.email} yet. Once you book with a business on Vanova, it'll show up here - you'll get a link straight back to this page in your confirmation.`}
          />
        ) : (
          <div className="space-y-10">
            {upcoming.length > 0 && (
              <div>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-4">
                  Upcoming
                </h2>
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <AccountBookingCard
                      key={b.id}
                      booking={b}
                      messages={
                        b.customer_phone ? conversationByPair.get(`${b.business_id}::${b.customer_phone}`) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-4">
                  Past
                </h2>
                <div className="space-y-3">
                  {past.map((b) => (
                    <AccountBookingCard
                      key={b.id}
                      booking={b}
                      messages={
                        b.customer_phone ? conversationByPair.get(`${b.business_id}::${b.customer_phone}`) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
