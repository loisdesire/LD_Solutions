import { createClient } from '@supabase/supabase-js';
import { todayInTimezone } from './timezone';
import { getBusinessTimezone } from './getBusinessTimezone';
import { formatLocalDateTime } from './formatDateTime';
import { getSubscriptionState, PLAN_LABEL, PLAN_PRICE_NGN } from './subscription';

// Server-side only, staff-facing counterpart to whatsappTools.ts. That file
// is customer-facing and deliberately exposes nothing about revenue, other
// customers, or business performance - this file is the opposite: read-only
// business-intelligence queries, gated (by the caller, lib/insightsAgent.ts)
// behind requireStaffApiSession AND hasBusinessIntelligence(), never reachable
// from the public booking chat. Every function here takes a businessId and
// scopes strictly to it - there is no cross-business query in this file.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type BookingRow = {
  customer_name: string | null;
  customer_phone: string | null;
  start_time: string;
  status: string;
  services: { name: string; price: number | null } | { name: string; price: number | null }[] | null;
};

function serviceOf(row: BookingRow): { name: string; price: number | null } | null {
  if (!row.services) return null;
  return Array.isArray(row.services) ? (row.services[0] ?? null) : row.services;
}

// Every function below excludes cancelled bookings from revenue/counts -
// a cancelled booking never happened as far as "how much have we made" or
// "who are our top customers" is concerned, same convention as the rest of
// the codebase (see findCustomerBookings, findOwnedBooking in whatsappTools.ts).
async function fetchBookings(businessId: string, fromISO?: string, toISO?: string) {
  let query = supabaseAdmin
    .from('bookings')
    .select('customer_name, customer_phone, start_time, status, services(name, price)')
    .eq('business_id', businessId)
    .neq('status', 'cancelled');

  if (fromISO) query = query.gte('start_time', fromISO);
  if (toISO) query = query.lte('start_time', toISO);

  const { data } = await query;
  return (data ?? []) as unknown as BookingRow[];
}

export async function getRevenue(businessId: string, args: { from?: string; to?: string }) {
  const bookings = await fetchBookings(businessId, args.from, args.to);
  let total = 0;
  let paidBookings = 0;
  for (const b of bookings) {
    const price = serviceOf(b)?.price;
    if (price) {
      total += price;
      paidBookings += 1;
    }
  }
  return {
    range: { from: args.from ?? 'all time', to: args.to ?? 'now' },
    total_revenue: total,
    bookings_counted: bookings.length,
    priced_bookings: paidBookings,
  };
}

export async function getTopCustomers(businessId: string, args: { limit?: number }) {
  const bookings = await fetchBookings(businessId);
  const byCustomer = new Map<
    string,
    { name: string; visits: number; spend: number; lastVisit: string }
  >();

  for (const b of bookings) {
    // Group by phone when present (the one stable identifier across a
    // customer's bookings - see the customerPhone convention in
    // whatsappTools.ts), falling back to name for old/manually-entered
    // rows that predate a phone being required.
    const key = b.customer_phone || b.customer_name || 'unknown';
    const price = serviceOf(b)?.price ?? 0;
    const existing = byCustomer.get(key);
    if (existing) {
      existing.visits += 1;
      existing.spend += price;
      if (b.start_time > existing.lastVisit) existing.lastVisit = b.start_time;
    } else {
      byCustomer.set(key, {
        name: b.customer_name || 'Unknown',
        visits: 1,
        spend: price,
        lastVisit: b.start_time,
      });
    }
  }

  const sorted = [...byCustomer.values()].sort((a, b) => b.spend - a.spend).slice(0, args.limit ?? 5);
  return {
    top_customers: sorted.map((c) => ({
      name: c.name,
      visits: c.visits,
      total_spend: c.spend,
      last_visit: c.lastVisit,
    })),
  };
}

export async function getTopServices(businessId: string, args: { limit?: number }) {
  const bookings = await fetchBookings(businessId);
  const byService = new Map<string, { count: number; revenue: number }>();

  for (const b of bookings) {
    const service = serviceOf(b);
    if (!service) continue;
    const existing = byService.get(service.name);
    if (existing) {
      existing.count += 1;
      existing.revenue += service.price ?? 0;
    } else {
      byService.set(service.name, { count: 1, revenue: service.price ?? 0 });
    }
  }

  const sorted = [...byService.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, args.limit ?? 5);
  return {
    top_services: sorted.map(([name, s]) => ({ name, bookings: s.count, revenue: s.revenue })),
  };
}

export async function getNextAppointment(businessId: string) {
  const timeZone = await getBusinessTimezone(businessId);
  const { data } = await supabaseAdmin
    .from('bookings')
    .select('customer_name, start_time, services(name)')
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .gte('start_time', new Date().toISOString())
    .order('start_time')
    .limit(1)
    .maybeSingle();

  if (!data) return { next_appointment: null };

  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  return {
    next_appointment: {
      customer: data.customer_name,
      service: service?.name ?? null,
      when: formatLocalDateTime(data.start_time, timeZone),
    },
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The only function in this file that deliberately does NOT exclude
// cancelled/no-show bookings - every other tool here treats "cancelled"
// as "never happened," which is correct for revenue/top-customers/etc.,
// but is exactly the data get_cancellations_and_no_shows exists to
// surface. Kept as its own query rather than a fetchBookings variant, so
// nobody accidentally reuses it somewhere that actually wants the
// cancelled-excluded convention.
export async function getCancellationsAndNoShows(businessId: string, args: { from?: string; to?: string }) {
  let query = supabaseAdmin
    .from('bookings')
    .select('status')
    .eq('business_id', businessId);
  if (args.from) query = query.gte('start_time', args.from);
  if (args.to) query = query.lte('start_time', args.to);

  const { data } = await query;
  const rows = data ?? [];

  const counts = { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 } as Record<string, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const total = rows.length;
  const cancellationRate = total > 0 ? Math.round(((counts.cancelled + counts.no_show) / total) * 1000) / 10 : 0;

  return {
    range: { from: args.from ?? 'all time', to: args.to ?? 'now' },
    total_bookings: total,
    cancelled: counts.cancelled,
    no_show: counts.no_show,
    completed: counts.completed,
    confirmed: counts.confirmed,
    cancelled_or_no_show_rate_pct: cancellationRate,
  };
}

// Day-of-week / hour-of-day breakdown, in the business's own timezone -
// a booking's raw UTC start_time would give the wrong "busiest day" for
// any business not in UTC (a 11pm UTC booking might be the next morning
// locally).
export async function getBusiestTimes(businessId: string) {
  const timeZone = await getBusinessTimezone(businessId);
  const bookings = await fetchBookings(businessId);

  const byDay = new Map<string, number>();
  const byHour = new Map<number, number>();

  for (const b of bookings) {
    const d = new Date(b.start_time);
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(d);
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(d));
    byDay.set(dayName, (byDay.get(dayName) ?? 0) + 1);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }

  const dayBreakdown = DAY_NAMES.map((day) => ({ day, bookings: byDay.get(day) ?? 0 })).sort(
    (a, b) => b.bookings - a.bookings
  );
  const hourBreakdown = [...byHour.entries()]
    .map(([hour, count]) => ({ hour: `${hour.toString().padStart(2, '0')}:00`, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings);

  return {
    busiest_day: dayBreakdown[0]?.day ?? null,
    busiest_hour: hourBreakdown[0]?.hour ?? null,
    by_day: dayBreakdown,
    by_hour_top_5: hourBreakdown.slice(0, 5),
  };
}

// Unlike get_top_customers (a top-5 leaderboard), this looks up ONE
// customer by name or phone - someone outside the top 5 was previously
// just invisible to this agent entirely.
export async function findCustomer(businessId: string, args: { query: string }) {
  const bookings = await fetchBookings(businessId);
  const q = args.query.trim().toLowerCase();

  const matches = bookings.filter(
    (b) => b.customer_name?.toLowerCase().includes(q) || b.customer_phone?.toLowerCase().includes(q)
  );

  if (matches.length === 0) return { found: false, message: `No customer matching "${args.query}" found.` };

  const byCustomer = new Map<string, { name: string; phone: string | null; visits: number; spend: number; lastVisit: string }>();
  for (const b of matches) {
    const key = b.customer_phone || b.customer_name || 'unknown';
    const price = serviceOf(b)?.price ?? 0;
    const existing = byCustomer.get(key);
    if (existing) {
      existing.visits += 1;
      existing.spend += price;
      if (b.start_time > existing.lastVisit) existing.lastVisit = b.start_time;
    } else {
      byCustomer.set(key, { name: b.customer_name || 'Unknown', phone: b.customer_phone, visits: 1, spend: price, lastVisit: b.start_time });
    }
  }

  return {
    found: true,
    customers: [...byCustomer.values()].map((c) => ({
      name: c.name,
      phone: c.phone,
      visits: c.visits,
      total_spend: c.spend,
      last_visit: c.lastVisit,
    })),
  };
}

// "Who hasn't booked in a while" - every past customer whose most recent
// visit is older than the cutoff AND who has nothing upcoming (someone
// with a future booking already isn't at risk of being forgotten).
export async function getInactiveCustomers(businessId: string, args: { days?: number; limit?: number }) {
  const days = args.days ?? 60;
  const bookings = await fetchBookings(businessId);
  const now = Date.now();
  const cutoff = now - days * 86400000;

  const byCustomer = new Map<string, { name: string; phone: string | null; lastVisit: string; hasUpcoming: boolean; visits: number }>();
  for (const b of bookings) {
    const key = b.customer_phone || b.customer_name || 'unknown';
    const isUpcoming = new Date(b.start_time).getTime() >= now;
    const existing = byCustomer.get(key);
    if (existing) {
      existing.visits += 1;
      if (b.start_time > existing.lastVisit) existing.lastVisit = b.start_time;
      if (isUpcoming) existing.hasUpcoming = true;
    } else {
      byCustomer.set(key, { name: b.customer_name || 'Unknown', phone: b.customer_phone, lastVisit: b.start_time, hasUpcoming: isUpcoming, visits: 1 });
    }
  }

  const inactive = [...byCustomer.values()]
    .filter((c) => !c.hasUpcoming && new Date(c.lastVisit).getTime() < cutoff)
    .sort((a, b) => new Date(a.lastVisit).getTime() - new Date(b.lastVisit).getTime())
    .slice(0, args.limit ?? 10);

  return {
    cutoff_days: days,
    inactive_customers: inactive.map((c) => ({
      name: c.name,
      phone: c.phone,
      visits: c.visits,
      last_visit: c.lastVisit,
      days_since_last_visit: Math.floor((now - new Date(c.lastVisit).getTime()) / 86400000),
    })),
  };
}

// Does the from/to → previous-period-of-equal-length subtraction itself,
// server-side, deterministically - rather than the model calling
// get_revenue twice and doing the arithmetic (and the date-range math for
// "the same length period right before this one") itself, which is
// exactly the kind of thing worth not trusting an LLM to get right twice
// in a row.
export async function compareRevenuePeriods(
  businessId: string,
  args: { from?: string; to?: string } = {}
) {
  // "How am I doing this month vs last?" is the overwhelmingly common form
  // of this question, so it's the default rather than an error. Previously
  // a call with no arguments (or an unparseable date) reached
  // .toISOString() on an Invalid Date and threw, which - before agentLoop
  // caught tool errors - 500'd the whole conversation.
  const now = new Date();
  const to = args.to ? new Date(args.to) : now;
  const from = args.from
    ? new Date(args.from)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: 'Those dates could not be understood. Use ISO format, e.g. 2026-08-01.' };
  }

  const lengthMs = to.getTime() - from.getTime();
  if (lengthMs <= 0) return { error: 'to must be after from.' };

  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - lengthMs);

  const [current, previous] = await Promise.all([
    fetchBookings(businessId, from.toISOString(), to.toISOString()),
    fetchBookings(businessId, prevFrom.toISOString(), prevTo.toISOString()),
  ]);

  const sum = (rows: BookingRow[]) => rows.reduce((s, b) => s + (serviceOf(b)?.price ?? 0), 0);
  const currentRevenue = sum(current);
  const previousRevenue = sum(previous);
  const pctChange =
    previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10 : null;

  return {
    current_period: { from: from.toISOString(), to: to.toISOString(), revenue: currentRevenue, bookings: current.length },
    previous_period: { from: prevFrom.toISOString(), to: prevTo.toISOString(), revenue: previousRevenue, bookings: previous.length },
    pct_change: pctChange,
  };
}

// The one tool in this file that touches a different table entirely
// (subscriptions, not bookings) - "when does my trial end" / "what plan
// am I on" is still a completely reasonable question for this agent to
// answer, it just needed its own query rather than being derivable from
// booking data. Same 42703 fallback as the billing page itself, since the
// `plan` column may not exist yet on a given deployment.
export async function getBillingStatus(businessId: string) {
  let { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end, plan')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error?.code === '42703') {
    const fallback = await supabaseAdmin
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end')
      .eq('business_id', businessId)
      .maybeSingle();
    sub = fallback.data ? { ...fallback.data, plan: null } : null;
  }

  const state = getSubscriptionState(sub ?? null);

  return {
    phase: state.phase,
    has_access: state.hasAccess,
    trial_days_left: state.trialDaysLeft,
    current_period_end: state.currentPeriodEnd,
    plan: PLAN_LABEL[state.plan],
    monthly_price_ngn: PLAN_PRICE_NGN[state.plan],
  };
}

export async function getBusinessSnapshot(businessId: string) {
  const timeZone = await getBusinessTimezone(businessId);
  const today = todayInTimezone(timeZone);
  const startOfMonth = `${today.slice(0, 7)}-01`;

  const [allBookings, thisMonth] = await Promise.all([
    fetchBookings(businessId),
    fetchBookings(businessId, new Date(startOfMonth).toISOString()),
  ]);

  const distinctCustomers = new Set(allBookings.map((b) => b.customer_phone || b.customer_name || 'unknown'));
  const monthRevenue = thisMonth.reduce((sum, b) => sum + (serviceOf(b)?.price ?? 0), 0);

  return {
    total_customers: distinctCustomers.size,
    total_bookings_all_time: allBookings.length,
    bookings_this_month: thisMonth.length,
    revenue_this_month: monthRevenue,
  };
}
