import { requireStaffSession } from '@/lib/requireStaffSession';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';
import DashboardHeaderActions from '@/components/DashboardHeaderActions';

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

function relativeDay(date: Date, today: Date): string {
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business } = await requireStaffSession(slug);

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, customer_name, customer_phone, customer_email, start_time, status, services(name, price, duration_minutes)'
    )
    .eq('business_id', business.id)
    .order('start_time', { ascending: true });

  const statusStyle: Record<string, string> = {
    confirmed: 'bg-accent-soft text-accent',
    completed: 'bg-ink/5 text-ink-faint',
    cancelled: 'bg-ink/5 text-ink-faint line-through',
    no_show: 'bg-red-50 text-red-600',
  };

  const all = bookings ?? [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const startOfPrevWeek = new Date(startOfWeek);
  startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

  const active = all.filter((b) => b.status !== 'cancelled');
  const todayCount = active.filter((b) => {
    const d = new Date(b.start_time);
    return d >= startOfToday && d < new Date(startOfToday.getTime() + 86400000);
  }).length;
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
    customer_phone: b.customer_phone,
    start_time: b.start_time,
    status: b.status,
    service_name: b.services?.name ?? null,
  }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
            Manage
          </div>
          <h1 className="font-display text-[26px] text-ink">Dashboard</h1>
        </div>
        <DashboardHeaderActions slug={slug} rows={exportRows} />
      </div>

      {all.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-line rounded-md mb-8 overflow-hidden">
          <div className="p-4 sm:p-5 border-r border-b sm:border-b-0 border-line">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-2">
              Today
            </div>
            <div className="font-display text-[26px] leading-none">{todayCount}</div>
            <div className="text-[11px] text-ink-faint mt-1.5">bookings</div>
          </div>
          <div className="p-4 sm:p-5 border-r border-b sm:border-b-0 border-line">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-2">
              This week
            </div>
            <div className="font-display text-[26px] leading-none">{thisWeek.length}</div>
            <div className={`text-[11px] mt-1.5 ${weekCountDelta >= 0 ? 'text-accent' : 'text-ink-faint'}`}>
              {weekCountDelta >= 0 ? '+' : ''}
              {weekCountDelta} vs last week
            </div>
          </div>
          <div className="p-4 sm:p-5 border-r border-line">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-2">
              Week revenue
            </div>
            <div className="font-display text-[26px] leading-none">
              {weekRevenue ? `₦${weekRevenue.toLocaleString()}` : '—'}
            </div>
            <div className="text-[11px] text-ink-faint mt-1.5">
              {revenuePctDelta === null
                ? '—'
                : `${revenuePctDelta >= 0 ? '+' : ''}${revenuePctDelta}% vs last week`}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-2">
              Next slot
            </div>
            {nextSlot ? (
              <>
                <div className="font-display text-[19px] leading-tight">
                  {relativeDay(new Date(nextSlot.start_time), startOfToday)}
                </div>
                <div className="font-mono text-[13px] text-accent mt-0.5">
                  {new Date(nextSlot.start_time).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-[11px] text-ink-faint mt-1 truncate">
                  {nextSlot.customer_name} · {(nextSlot as any).services?.name}
                </div>
              </>
            ) : (
              <div className="font-display text-[26px] leading-none text-ink-faint">—</div>
            )}
          </div>
        </div>
      )}

      {all.length === 0 ? (
        <div className="border border-dashed border-line-strong rounded-md p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-12 w-12 rounded-md bg-accent-soft flex items-center justify-center text-accent">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-display text-[20px]">No bookings yet — that's normal</h2>
          <p className="text-ink-soft text-[13.5px] mt-1.5 max-w-sm mx-auto">
            The moment someone books through your page, they'll show up right here with
            all their details.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href={`/${slug}/admin/services`}
              className="rounded-md border border-line-strong px-4 py-2 text-[13.5px] font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Add a service
            </Link>
            <Link
              href={`/${slug}/admin/hours`}
              className="rounded-md border border-line-strong px-4 py-2 text-[13.5px] font-medium hover:border-accent hover:text-accent transition-colors"
            >
              Set your hours
            </Link>
          </div>
          <div className="font-mono text-[10.5px] text-ink-faint mt-6 tracking-[0.05em]">
            /{slug}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-[18px]">Upcoming bookings</h2>
            <span className="font-mono text-[11px] text-ink-faint">{all.length} booked</span>
          </div>
          <div className="border border-line rounded-md overflow-hidden">
            <div className="hidden sm:grid grid-cols-[70px_1.4fr_1.3fr_1fr_120px] gap-4 px-5 py-2.5 bg-paper border-b border-line font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              <div>When</div>
              <div>Customer</div>
              <div>Service</div>
              <div>Contact</div>
              <div>Status</div>
            </div>
            {all.map((b: any, i: number) => (
              <div
                key={b.id}
                className={`flex flex-col gap-2.5 sm:grid sm:grid-cols-[70px_1.4fr_1.3fr_1fr_120px] sm:gap-4 sm:items-center px-5 py-4 hover:bg-accent-soft/40 transition-colors ${
                  i !== all.length - 1 ? 'border-b border-line' : ''
                } ${b.status === 'cancelled' ? 'opacity-55' : ''}`}
              >
                <div className="flex items-center justify-between sm:block">
                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                      {relativeDay(new Date(b.start_time), startOfToday)}
                    </span>
                    <span className="font-mono text-[14px] text-accent ml-2 sm:ml-0 sm:block sm:mt-0.5">
                      {new Date(b.start_time).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span
                    className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 ${statusStyle[b.status] ?? 'bg-ink/5 text-ink-faint'}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {b.status.replace('_', ' ')}
                  </span>
                </div>

                <div className={b.status === 'cancelled' ? 'line-through' : ''}>
                  <div className="font-semibold text-[14px] truncate">{b.customer_name}</div>
                  {b.customer_email && (
                    <div className="font-mono text-[11.5px] text-ink-faint truncate mt-0.5">
                      {b.customer_email}
                    </div>
                  )}
                </div>

                <div className={`flex items-center justify-between sm:block ${b.status === 'cancelled' ? 'line-through' : ''}`}>
                  <div>
                    <span className="text-[13.5px]">{b.services?.name}</span>
                    {b.services?.duration_minutes != null && (
                      <span className="font-mono text-[11px] text-ink-faint ml-2 sm:block sm:ml-0 sm:mt-0.5">
                        {b.services.duration_minutes} min
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[12px] text-ink-soft sm:hidden">{b.customer_phone}</span>
                </div>

                <div className="hidden sm:block font-mono text-[13px] text-ink-soft truncate">
                  {b.customer_phone}
                </div>

                <span
                  className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 w-fit ${statusStyle[b.status] ?? 'bg-ink/5 text-ink-faint'}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {b.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
