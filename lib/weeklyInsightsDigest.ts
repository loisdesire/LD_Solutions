import { createClient } from '@supabase/supabase-js';
import { compareRevenuePeriods, getCancellationsAndNoShows } from './insightsTools';
import { formatMoney } from './formatMoney';
import type { EmailRow } from './emailTemplate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Deliberately deterministic, not a live LLM call per business - this
// runs unattended, once a week, for every Business Intelligence business
// at once (see app/api/cron/weekly-insights/route.ts). Real numbers,
// computed the same way the on-demand insights chat already computes
// them (compareRevenuePeriods/getCancellationsAndNoShows are the exact
// functions that chat calls), reused rather than reimplemented - the
// "AI" in "weekly AI insights" is that this is the same intelligence
// that already answers "how's my week going" on demand, just sent
// proactively instead of waiting to be asked. Nothing here is generated
// text a bad week could turn into something wrong or embarrassing in
// someone's inbox.
export async function buildWeeklyDigestRows(businessId: string): Promise<EmailRow[]> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const fromISO = weekAgo.toISOString();
  const toISO = now.toISOString();

  const [revenueCompare, cancellations, topServiceRows] = await Promise.all([
    compareRevenuePeriods(businessId, { from: fromISO, to: toISO }),
    getCancellationsAndNoShows(businessId, { from: fromISO, to: toISO }),
    // Not reusing insightsTools.ts's getTopServices - it's all-time only
    // (no from/to param), which doesn't fit a weekly digest. Same shape
    // of query as that function, just scoped to this week specifically.
    supabaseAdmin
      .from('bookings')
      .select('services(name)')
      .eq('business_id', businessId)
      .neq('status', 'cancelled')
      .gte('start_time', fromISO)
      .lte('start_time', toISO),
  ]);

  const rows: EmailRow[] = [];

  if ('error' in revenueCompare) {
    rows.push({ label: 'This week', value: 'Could not be calculated' });
  } else {
    const { current_period, pct_change } = revenueCompare;
    rows.push({
      label: 'Bookings this week',
      value: `${current_period.bookings}${revenueCompare.previous_period.bookings ? ` (was ${revenueCompare.previous_period.bookings} last week)` : ''}`,
    });
    rows.push({
      label: 'Revenue this week',
      value:
        pct_change === null
          ? formatMoney(current_period.revenue)
          : `${formatMoney(current_period.revenue)} (${pct_change > 0 ? '+' : ''}${pct_change}% vs last week)`,
    });
  }

  const serviceCounts = new Map<string, number>();
  for (const row of topServiceRows.data ?? []) {
    const service = Array.isArray(row.services) ? row.services[0] : row.services;
    const name = (service as { name?: string } | null)?.name;
    if (!name) continue;
    serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  }
  const topService = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topService) {
    rows.push({ label: 'Most booked', value: `${topService[0]} (${topService[1]} ${topService[1] === 1 ? 'booking' : 'bookings'})` });
  }

  if (cancellations.total_bookings > 0 && (cancellations.cancelled > 0 || cancellations.no_show > 0)) {
    const parts: string[] = [];
    if (cancellations.cancelled > 0) parts.push(`${cancellations.cancelled} cancelled`);
    if (cancellations.no_show > 0) parts.push(`${cancellations.no_show} no-show${cancellations.no_show === 1 ? '' : 's'}`);
    rows.push({ label: 'Cancellations & no-shows', value: parts.join(', ') });
  }

  return rows;
}

// Every business with an owner and an active Business Intelligence
// subscription - matches the same gate assistantAgent.ts already applies
// to the on-demand insights chat (hasBusinessIntelligence), so this is
// never sending a Core-plan business a feature it isn't paying for.
export async function getWeeklyDigestRecipients(): Promise<{ businessId: string; businessName: string; slug: string; accentColor: string | null; logoUrl: string | null; ownerEmail: string }[]> {
  const { data: activeSubs } = await supabaseAdmin
    .from('subscriptions')
    .select('business_id, status, plan')
    .eq('status', 'active')
    .eq('plan', 'business_intelligence');

  // Same defensive fallback as hasBusinessIntelligence - if `plan` isn't a
  // real column yet on this deployment, the select above fails as a whole
  // unit and activeSubs is null. No businesses qualify in that case
  // (there's no way to tell who's actually on Business Intelligence
  // without that column), which is the same "resolve to false" default
  // hasBusinessIntelligence itself falls back to.
  if (!activeSubs || activeSubs.length === 0) return [];

  const businessIds = activeSubs.map((s) => s.business_id);

  const [{ data: businesses }, { data: owners }] = await Promise.all([
    supabaseAdmin.from('businesses').select('id, name, slug, accent_color, logo_url').in('id', businessIds),
    supabaseAdmin.from('staff').select('business_id, email').eq('role', 'owner').in('business_id', businessIds),
  ]);

  const ownerEmailByBusiness = new Map((owners ?? []).map((o) => [o.business_id, o.email]));

  return (businesses ?? [])
    .map((b) => ({
      businessId: b.id,
      businessName: b.name,
      slug: b.slug,
      accentColor: b.accent_color,
      logoUrl: b.logo_url,
      ownerEmail: ownerEmailByBusiness.get(b.id) ?? '',
    }))
    .filter((b) => b.ownerEmail);
}
