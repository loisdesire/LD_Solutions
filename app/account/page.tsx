import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import AccountBookingCard from '@/components/AccountBookingCard';
import LogoutButton from '@/components/LogoutButton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My bookings',
  robots: { index: false, follow: false },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function StatCard({ label, value, iconPath, color }: { label: string; value: string; iconPath: string; color: string }) {
  return (
    <div className="rounded-xl bg-surface border border-line p-5">
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center mb-4"
        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">{label}</div>
      <div className="font-display text-[22px] leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect('/account/login');

  // Service role: bookings aren't publicly readable, but we've already
  // verified the requester's identity via their authenticated session
  // above — matching by email is the whole point of this page, not a
  // bypass of it.
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, business_id, customer_phone, start_time, status, businesses(name, slug), services(name, duration_minutes, price)'
    )
    .eq('customer_email', user.email)
    .order('start_time', { ascending: false });

  const rows = bookings ?? [];

  // Chat history is keyed by (business_id, customer_phone), not by
  // account/email — a customer might have chatted via a phone number tied
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-11 w-11 rounded-full text-white flex items-center justify-center font-display text-[16px] shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              {user.email[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[19px] text-ink leading-tight">My bookings</h1>
              <p className="text-ink-faint text-[12.5px] truncate">{user.email}</p>
            </div>
          </div>
          <LogoutButton />
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
            <StatCard
              label="Total"
              value={String(rows.length)}
              color="var(--progress)"
              iconPath="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
            />
            <StatCard
              label="Upcoming"
              value={String(upcoming.length)}
              color="var(--tertiary)"
              iconPath="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
            />
            <StatCard
              label="Businesses"
              value={String(new Set(rows.map((b) => b.business_id)).size)}
              color="var(--accent)"
              iconPath="M4 21V7l8-4 8 4v14M9 21v-6h6v6"
            />
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong py-16 text-center">
            <p className="text-ink-soft text-[14px]">
              No bookings found for this email yet — once you book somewhere, it'll show up here.
            </p>
          </div>
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
