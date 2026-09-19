import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { getSubscriptionState } from '@/lib/subscription';
import ImpersonateButton from '@/components/ImpersonateButton';

// Subscription phase labels - deliberately not lib/bookingStatus.ts's
// statusLabel, which maps a BOOKING status vocabulary (confirmed,
// pending_payment...) that shares no values with a subscription's phase
// (active, trial, past_due...). Reusing it would have coincidentally
// "worked" only via its fallback (.replace(/_/g, ' ')), not because it's
// actually the right mapping.
const PHASE_LABEL: Record<string, string> = {
  active: 'Active',
  cancelling: 'Cancelling',
  past_due: 'Past due',
  expired: 'Expired',
  none: 'No subscription',
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Every query on this page is service-role, bypassing RLS - the whole
// point of this page is seeing across every business at once, which no
// business's own RLS policies allow to begin with (each one is scoped to
// "your own business only", correctly). Safe specifically because this
// route is behind requireSuperAdminSession's email allowlist, not
// exposed anywhere a real business owner's own session could reach it.
export default async function SuperAdminPage() {
  const [{ data: businesses }, { data: subs }, { count: bookingsThisMonth }, { data: pendingReviews }] =
    await Promise.all([
      supabaseAdmin.from('businesses').select('id, slug, name, business_type, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('subscriptions').select('business_id, status, trial_ends_at, current_period_end, plan'),
      supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .neq('status', 'cancelled'),
      supabaseAdmin
        .from('owner_reviews')
        .select('id, business_id, customer_label, question, created_at, businesses(name, slug)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20),
    ]);

  const subByBusiness = new Map((subs ?? []).map((s) => [s.business_id, s]));
  const rows = (businesses ?? []).map((biz) => {
    const sub = subByBusiness.get(biz.id) ?? null;
    const state = getSubscriptionState(sub);
    return { ...biz, state };
  });

  const activeCount = rows.filter((r) => r.state.phase === 'active').length;
  const trialCount = rows.filter((r) => r.state.phase === 'trial').length;
  const lockedCount = rows.filter((r) => !r.state.hasAccess).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-h1 text-ink">Businesses</h1>
        <p className="text-ink-soft text-body-sm mt-1">Every business on the platform, cross-business at a glance.</p>
      </div>

      {/* Stat strip - same 4-card shape the per-business dashboard already
          uses (see AdminDashboardBody.tsx's TodayStat), reused here rather
          than a third differently-styled stat treatment. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total businesses', value: String(rows.length) },
          { label: 'Active subscriptions', value: String(activeCount) },
          { label: 'On trial', value: String(trialCount) },
          { label: 'Locked out', value: String(lockedCount) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-3.5 sm:p-4">
            <div className="text-[10.5px] sm:text-[11px] font-semibold text-ink-faint uppercase tracking-wider truncate">
              {s.label}
            </div>
            <div className="mt-2 font-display text-[20px] sm:text-[22px] font-bold tracking-tight leading-tight text-ink">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <p className="text-ink-faint text-[12.5px] mb-8">
        {bookingsThisMonth ?? 0} bookings platform-wide this month (excluding cancelled).
      </p>

      {/* Cross-business escalation queue - the same owner_reviews rows
          each business's own dashboard already surfaces individually
          (see AdminDashboardBody.tsx's pendingReviews), collected here
          across every business at once instead of checking each one. */}
      {pendingReviews && pendingReviews.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-[19px] font-semibold text-ink mb-3">
            Pending owner-review escalations
            <span className="ml-2 inline-flex items-center rounded-full bg-warning-bg text-warning px-2 py-0.5 font-mono text-[11px] align-middle">
              {pendingReviews.length}
            </span>
          </h2>
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {pendingReviews.map((r) => {
              const biz = (Array.isArray(r.businesses) ? r.businesses[0] : r.businesses) as
                | { name: string; slug: string }
                | null;
              return (
                <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink truncate">
                      {biz?.name ?? 'Unknown business'} · {r.customer_label}
                    </div>
                    <div className="text-[13px] text-ink-soft truncate mt-0.5">{r.question}</div>
                  </div>
                  {biz?.slug && (
                    <Link
                      href={`/${biz.slug}/admin`}
                      className="shrink-0 text-[12.5px] font-semibold text-accent hover:underline"
                    >
                      View
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="font-display text-[19px] font-semibold text-ink mb-3">All businesses</h2>
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_100px] gap-4 px-4 py-2.5 border-b border-line bg-warm-surface font-mono text-label uppercase tracking-[0.08em] text-ink-faint">
          <div>Business</div>
          <div>Plan status</div>
          <div>Created</div>
          <div />
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1.4fr_1fr_1fr_100px] gap-4 items-center px-4 py-3 border-b border-line last:border-0">
            <div className="min-w-0">
              <div className="font-semibold text-[14px] text-ink truncate">{r.name}</div>
              <div className="font-mono text-[12px] text-ink-faint truncate">/{r.slug}</div>
            </div>
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.05em] ${
                  r.state.hasAccess ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {r.state.phase === 'trial' ? `Trial, ${r.state.trialDaysLeft}d left` : PHASE_LABEL[r.state.phase] ?? r.state.phase}
              </span>
            </div>
            <div className="text-[13px] text-ink-soft">
              {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </div>
            <ImpersonateButton slug={r.slug} />
          </div>
        ))}
        {rows.length === 0 && <p className="px-4 py-8 text-center text-ink-faint text-body-sm">No businesses yet.</p>}
      </div>
    </div>
  );
}
