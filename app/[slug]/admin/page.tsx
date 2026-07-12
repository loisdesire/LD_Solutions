import { requireStaffSession } from '@/lib/requireStaffSession';
import { createClient } from '@supabase/supabase-js';
import AdminNav from '@/components/AdminNav';

// Server-side only: bookings contain customer PII, so this uses the service
// role key rather than opening a public RLS policy on the table.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business } = await requireStaffSession(slug);

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id, customer_name, customer_phone, customer_email, start_time, status, services(name)')
    .eq('business_id', business.id)
    .order('start_time', { ascending: true });

  const statusStyle: Record<string, string> = {
    confirmed: 'bg-accent/10 text-accent',
    completed: 'bg-ink/5 text-muted',
    cancelled: 'bg-ink/5 text-muted line-through',
    no_show: 'bg-red-50 text-red-600',
  };

  return (
    <main className="min-h-screen bg-canvas bg-grid">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 animate-rise">
        <AdminNav slug={slug} />

        <header className="mb-10 flex items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted shadow-sm mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Dashboard
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
              {business.name}
            </h1>
          </div>
          {bookings && bookings.length > 0 && (
            <div className="shrink-0 rounded-2xl border border-line bg-white px-5 py-3 text-center shadow-soft">
              <p className="text-2xl font-extrabold text-gradient leading-none">
                {bookings.length}
              </p>
              <p className="text-xs text-muted mt-1">
                booking{bookings.length === 1 ? '' : 's'}
              </p>
            </div>
          )}
        </header>

        {!bookings || bookings.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-line bg-white/50">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-brand opacity-80" />
            <p className="text-lg font-semibold">No bookings yet</p>
            <p className="text-muted text-sm mt-1">
              Once a customer books an appointment, it'll show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b: any) => (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:shadow-soft hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-brand flex items-center justify-center text-white text-sm font-semibold">
                    {b.customer_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{b.customer_name}</p>
                    <p className="text-muted text-sm truncate">{b.services?.name}</p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-sm font-medium">
                    {new Date(b.start_time).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <span
                    className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle[b.status] ?? 'bg-ink/5 text-muted'}`}
                  >
                    {b.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-muted text-xs sm:text-right sm:w-44 shrink-0">
                  {b.customer_phone && <p>{b.customer_phone}</p>}
                  {b.customer_email && <p>{b.customer_email}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
