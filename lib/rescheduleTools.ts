import { createClient } from '@supabase/supabase-js';
import { zonedTimeToUtc } from './timezone';
import { getBusinessTimezone } from './getBusinessTimezone';
import { formatLocalDateTime } from './formatDateTime';
import { getAvailableSlots } from './getAvailableSlots';
import { notifyCustomer, getNotifyCreds } from './notifyCustomer';

// Owner-facing, write-capable — the counterpart to insightsTools.ts (which
// is deliberately read-only). Two-step by design: proposeReschedule never
// touches a booking, it only computes a plan and persists it; applyReschedule
// only ever executes a plan that's already been shown to and approved by the
// owner. A model calling proposeReschedule twice in a row is harmless; a
// model calling applyReschedule on its own initiative without ever showing
// the plan is the failure mode this split exists to prevent — see the
// system prompt in lib/rescheduleAgent.ts for the actual enforcement.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Move = {
  booking_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_telegram_username: string | null;
  customer_email: string | null;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  old_start: string;
  old_when: string;
  new_start: string | null;
  new_when: string | null;
};

// Searches forward day by day for the earliest slot at/after `notBeforeISO`
// for this service — getAvailableSlots only ever answers for a single
// calendar date, so this is what turns that into "the next one, whenever
// that ends up being." Capped so a service with no working hours configured
// (or a business closed indefinitely) fails fast with "no slot found"
// instead of the caller waiting on ~3 weeks of sequential day-by-day queries.
const MAX_SEARCH_DAYS = 21;

async function findNextAvailableSlot(
  businessId: string,
  serviceId: string,
  timeZone: string,
  notBeforeISO: string
): Promise<string | null> {
  let cursor = new Date(notBeforeISO);
  for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
    const dateISO = new Intl.DateTimeFormat('en-CA', { timeZone }).format(cursor);
    const slots = await getAvailableSlots(businessId, serviceId, dateISO);
    const candidate = slots.find((iso) => new Date(iso).getTime() >= new Date(notBeforeISO).getTime());
    if (candidate) return candidate;
    cursor = new Date(cursor.getTime() + 24 * 3600_000);
  }
  return null;
}

export async function proposeReschedule(
  businessId: string,
  args: { date: string; startTime: string; endTime: string; reason?: string }
) {
  const timeZone = await getBusinessTimezone(businessId);
  const windowStart = zonedTimeToUtc(args.date, args.startTime, timeZone);
  const windowEnd = zonedTimeToUtc(args.date, args.endTime, timeZone);

  if (windowEnd <= windowStart) {
    return { error: 'End time must be after start time.' };
  }

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, customer_name, customer_phone, customer_telegram_username, customer_email, start_time, service_id, services(name, duration_minutes)'
    )
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .lt('start_time', windowEnd.toISOString())
    .gt('end_time', windowStart.toISOString())
    .order('start_time');

  const affected = bookings ?? [];
  if (affected.length === 0) {
    return { affected_bookings: 0, message: 'No bookings fall inside that window — nothing to reschedule.' };
  }

  const moves: Move[] = [];
  for (const b of affected) {
    const service = Array.isArray(b.services) ? b.services[0] : b.services;
    const duration = service?.duration_minutes ?? 30;
    const nextSlot = await findNextAvailableSlot(businessId, b.service_id, timeZone, windowEnd.toISOString());

    moves.push({
      booking_id: b.id,
      customer_name: b.customer_name,
      customer_phone: b.customer_phone,
      customer_telegram_username: b.customer_telegram_username,
      customer_email: b.customer_email,
      service_id: b.service_id,
      service_name: service?.name ?? 'appointment',
      duration_minutes: duration,
      old_start: b.start_time,
      old_when: formatLocalDateTime(b.start_time, timeZone),
      new_start: nextSlot,
      new_when: nextSlot ? formatLocalDateTime(nextSlot, timeZone) : null,
    });
  }

  const { data: plan, error } = await supabaseAdmin
    .from('reschedule_plans')
    .insert({
      business_id: businessId,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      reason: args.reason ?? null,
      moves,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    // PGRST205 = PostgREST can't find the table at all — the
    // reschedule_plans migration hasn't been run against this database
    // yet. A plain, model-friendly message beats leaking raw Postgres/
    // PostgREST internals into a chat reply.
    if (error.code === 'PGRST205') {
      return { error: "The scheduling assistant isn't fully set up on this account yet. Ask the business to check back soon." };
    }
    return { error: error.message };
  }

  return {
    plan_id: plan.id,
    affected_bookings: moves.length,
    moves: moves.map((m) => ({
      customer: m.customer_name,
      service: m.service_name,
      from: m.old_when,
      to: m.new_when ?? 'No open slot found in the next 3 weeks — this one needs manual handling.',
    })),
    instructions:
      'Show this exact plan to the owner, formatted clearly, and ask them to confirm before doing anything else. ' +
      'Only call apply_reschedule with this plan_id after the owner has explicitly said yes — never on your own judgment, ' +
      'and never for a plan you have not just shown them in this conversation.',
  };
}

// plan_id is optional on purpose. Each chat turn is its own API request —
// the client only resends plain text history (see AssistantChat.tsx), not
// the actual tool-call/tool-result exchange from earlier turns — so a
// model replying to "yeah" a turn *after* it proposed a plan has no way to
// know the exact plan_id it got back then; that value simply isn't in its
// context anymore. Requiring it as the only way in meant the model could
// never actually apply anything past turn one — it would just keep
// re-showing the same plan, unable to proceed. Falls back to this
// business's most recent still-pending plan, capped at an hour old so a
// stray confirmation in some unrelated later conversation can't reach
// back and apply a long-abandoned one.
const PENDING_PLAN_MAX_AGE_MS = 60 * 60_000;

export async function applyReschedule(businessId: string, args: { planId?: string }) {
  let plan: any = null;

  if (args.planId) {
    const { data } = await supabaseAdmin
      .from('reschedule_plans')
      .select('*')
      .eq('id', args.planId)
      .eq('business_id', businessId)
      .maybeSingle();
    plan = data;
  }

  if (!plan) {
    const { data } = await supabaseAdmin
      .from('reschedule_plans')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - PENDING_PLAN_MAX_AGE_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    plan = data;
  }

  if (!plan) return { error: 'No pending reschedule plan found to confirm. Call propose_reschedule again.' };
  if (plan.status !== 'pending') {
    return { error: `This plan was already ${plan.status === 'applied' ? 'applied' : plan.status} — propose a new one if you need to make another change.` };
  }

  const business = await getNotifyCreds(businessId);

  const moves = plan.moves as Move[];
  const results: { customer: string; service: string; applied: boolean; notified: boolean; detail: string }[] = [];

  for (const move of moves) {
    if (!move.new_start) {
      results.push({ customer: move.customer_name, service: move.service_name, applied: false, notified: false, detail: 'No available slot was found for this one — needs manual rescheduling.' });
      continue;
    }

    const newStart = new Date(move.new_start);
    const newEnd = new Date(newStart.getTime() + move.duration_minutes * 60000);

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
      .eq('id', move.booking_id)
      .neq('status', 'cancelled');

    if (error) {
      // 23P01 here means the slot this plan picked got taken by something
      // else between propose and apply (a new booking landed there) — real
      // but rare given the plan searches forward from a blocked window,
      // surfaced plainly rather than silently dropped.
      const detail = (error as { code?: string }).code === '23P01'
        ? 'That slot got booked by someone else in the meantime — needs manual rescheduling.'
        : error.message;
      results.push({ customer: move.customer_name, service: move.service_name, applied: false, notified: false, detail });
      continue;
    }

    const text = `Hi ${move.customer_name}, ${business.name ?? 'we'} had to move your ${move.service_name} appointment. Your new time is ${move.new_when}. Sorry for the short notice — reply here if that doesn't work for you.`;
    const notified = await notifyCustomer(
      business,
      move,
      text,
      `Your appointment has been rescheduled`,
      'rescheduleTools:applyReschedule',
      { businessId, bookingId: move.booking_id }
    );

    results.push({ customer: move.customer_name, service: move.service_name, applied: true, notified, detail: notified ? 'Moved and customer notified.' : 'Moved, but the customer could not be notified automatically — let them know directly.' });
  }

  await supabaseAdmin.from('reschedule_plans').update({ status: 'applied' }).eq('id', plan.id);

  return {
    applied: results.filter((r) => r.applied).length,
    needs_manual_handling: results.filter((r) => !r.applied).length,
    results,
  };
}
