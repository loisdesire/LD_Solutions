import { createClient } from '@supabase/supabase-js';
import { getAvailableSlots } from './getAvailableSlots';
import { todayInTimezone, daysBetween, zonedTimeToUtc } from './timezone';
import { sendEmail } from './email';

// Server-side only. This file has zero awareness of OpenAI, Anthropic, or
// Twilio — it's the same booking logic the web app already uses (services,
// availability, bookings), just exposed as functions an AI agent can call
// by name. lib/whatsappAgent.ts is the only place that knows which AI
// provider is calling these.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ToolContext = {
  businessId: string;
  // Opaque per-channel customer identifier — never model-supplied. WhatsApp
  // uses Twilio's 'whatsapp:+...' From field; Telegram uses 'telegram:<chatId>'.
  // Reusing the same bookings.customer_phone column across channels avoids a
  // schema change; it's just a stable "who to reply to" key, not validated
  // as an actual phone number anywhere in this codebase.
  customerPhone: string;
  // Telegram-only, and only when the customer has a public username set —
  // it's the one thing that makes a Telegram customer actually contactable
  // outside the bot (t.me/<username> opens a real chat; the numeric chat id
  // in customerPhone can't be turned into a clickable link on its own).
  customerUsername?: string;
};

export async function getBusinessByWhatsappNumber(whatsappNumber: string) {
  const { data } = await supabaseAdmin
    .from('businesses')
    .select('id, name, timezone')
    .eq('whatsapp_number', whatsappNumber)
    .maybeSingle();
  return data;
}

// Meta's Cloud API webhook is shared across every number registered to the
// same App/WABA — unlike Telegram's per-bot URL, there's no per-business
// webhook to route by, so the business is identified by matching the
// phone_number_id Meta includes in every inbound payload instead.
export async function getBusinessByMetaPhoneNumberId(phoneNumberId: string) {
  const { data } = await supabaseAdmin
    .from('businesses')
    .select('id, name, timezone, whatsapp_access_token')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle();
  return data;
}

export async function getBusinessByMessengerPageId(pageId: string) {
  const { data } = await supabaseAdmin
    .from('businesses')
    .select('id, name, timezone, messenger_access_token')
    .eq('messenger_page_id', pageId)
    .maybeSingle();
  return data;
}

export async function getBusinessByTelegramToken(botToken: string) {
  const { data } = await supabaseAdmin
    .from('businesses')
    .select('id, name, timezone')
    .eq('telegram_bot_token', botToken)
    .maybeSingle();
  return data;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getBusinessContext(businessId: string) {
  const [{ data: business }, { data: services }, { data: hours }] = await Promise.all([
    supabaseAdmin.from('businesses').select('id, name, timezone').eq('id', businessId).single(),
    supabaseAdmin
      .from('services')
      .select('name, duration_minutes, price')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name'),
    // Business-wide hours only (staff_id is null) — enough for FAQ answers
    // like "are you open Sundays", without the agent having to call
    // check_availability just to answer a general hours question.
    supabaseAdmin
      .from('availability')
      .select('day_of_week, start_time, end_time')
      .eq('business_id', businessId)
      .is('staff_id', null)
      .order('day_of_week'),
  ]);

  const weeklyHours = DAY_NAMES.map((day, i) => {
    const row = (hours ?? []).find((h) => h.day_of_week === i);
    return row ? `${day} ${row.start_time.slice(0, 5)}-${row.end_time.slice(0, 5)}` : `${day} closed`;
  });

  return { business, services: services ?? [], weeklyHours };
}

// The model repeatedly doing UTC→local mental math across a long conversation
// is exactly the kind of arithmetic LLMs get wrong silently — it caused a real
// bug where a booking confirmed as "8:00 AM" got redisplayed later as "07:00"
// (the raw UTC hour). Formatting server-side, deterministically, removes that
// error class entirely: the model only ever sees an already-correct string.
function formatLocalDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLocalTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

function to24Hour(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
}

async function findActiveService(businessId: string, serviceName: string) {
  const { data } = await supabaseAdmin
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('business_id', businessId)
    .eq('active', true)
    .ilike('name', `%${serviceName}%`)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function checkAvailability(ctx: ToolContext, args: { serviceName: string; date: string }) {
  const service = await findActiveService(ctx.businessId, args.serviceName);
  if (!service) {
    const { data: allServices } = await supabaseAdmin
      .from('services')
      .select('name')
      .eq('business_id', ctx.businessId)
      .eq('active', true);
    return {
      error: `No service matching "${args.serviceName}" found.`,
      available_services: (allServices ?? []).map((s) => s.name),
    };
  }

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('timezone')
    .eq('id', ctx.businessId)
    .single();
  const timeZone = business?.timezone || 'UTC';

  const slots = await getAvailableSlots(ctx.businessId, service.id, args.date);

  return {
    service: service.name,
    duration_minutes: service.duration_minutes,
    price: service.price,
    date: args.date,
    // `label` is what to show the customer. `time_24h` is the exact value to
    // pass back as create_booking's `time` argument — no conversion needed
    // either direction, removing the model's UTC/local arithmetic entirely.
    available_times: slots.map((iso) => ({
      label: formatLocalTime(iso, timeZone),
      time_24h: to24Hour(iso, timeZone),
    })),
  };
}

export async function createBooking(
  ctx: ToolContext,
  args: { serviceName: string; date: string; time: string; customerName: string; customerEmail?: string }
) {
  const service = await findActiveService(ctx.businessId, args.serviceName);
  if (!service) return { error: `No service matching "${args.serviceName}" found.` };

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('timezone')
    .eq('id', ctx.businessId)
    .single();
  const timeZone = business?.timezone || 'UTC';

  const start = zonedTimeToUtc(args.date, args.time, timeZone);
  const end = new Date(start.getTime() + service.duration_minutes * 60000);

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      business_id: ctx.businessId,
      service_id: service.id,
      customer_name: args.customerName,
      customer_phone: ctx.customerPhone,
      customer_email: args.customerEmail || null,
      customer_telegram_username: ctx.customerUsername || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23P01') {
      return { error: 'That time is no longer available. Please choose another slot.' };
    }
    return { error: error.message };
  }

  // Same fire-and-forget confirmation email as the web booking flow
  // (app/api/bookings/route.ts) — failure here never blocks the booking.
  if (args.customerEmail) {
    await sendEmail(
      {
        to: args.customerEmail,
        subject: 'Your appointment is confirmed',
        html: `<p>Hi ${args.customerName}, your ${service.name} appointment is confirmed for ${start.toLocaleString()}.</p>`,
      },
      'whatsappTools:createBooking:confirmation-email',
      { businessId: ctx.businessId }
    );
  }

  return {
    confirmed: true,
    booking_id: booking.id,
    service: service.name,
    when: formatLocalDateTime(booking.start_time, timeZone),
  };
}

export async function findCustomerBookings(ctx: ToolContext) {
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('timezone')
    .eq('id', ctx.businessId)
    .single();
  const timeZone = business?.timezone || 'UTC';

  const { data } = await supabaseAdmin
    .from('bookings')
    .select('id, start_time, status, services(name)')
    .eq('business_id', ctx.businessId)
    .eq('customer_phone', ctx.customerPhone)
    .neq('status', 'cancelled')
    .gte('start_time', new Date().toISOString())
    .order('start_time');

  return {
    // No id exposed here on purpose — cancel/reschedule identify a booking
    // by service + date + time (which the model tracks reliably from natural
    // conversation), not by asking the model to transcribe a UUID it saw in
    // a previous turn. `when` is the only time representation given here too,
    // so there's nothing left for it to (mis)calculate either.
    bookings: (data ?? []).map((b) => ({
      service: (b.services as unknown as { name: string } | null)?.name,
      when: formatLocalDateTime(b.start_time, timeZone),
      status: b.status,
    })),
  };
}

// Cancel/reschedule identify the booking by service + date + time rather
// than a raw booking id. A per-turn conversation only carries forward
// human-readable text (see loadConversation/saveConversation below), not
// prior tool results, so a model-transcribed UUID from a find_customer_
// bookings call several turns back is exactly the kind of thing an LLM
// garbles — a copy error there silently looks identical to "not found".
// Service + date + time is what the model naturally tracks correctly in
// conversation anyway, so this removes that failure mode entirely.
async function findOwnedBooking(ctx: ToolContext, args: { serviceName: string; date: string; time: string }) {
  const service = await findActiveService(ctx.businessId, args.serviceName);
  if (!service) return null;

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('timezone')
    .eq('id', ctx.businessId)
    .single();
  const timeZone = business?.timezone || 'UTC';

  const target = zonedTimeToUtc(args.date, args.time, timeZone);

  const { data } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id, customer_phone, status, start_time, service_id, services(duration_minutes)')
    .eq('business_id', ctx.businessId)
    .eq('customer_phone', ctx.customerPhone)
    .eq('service_id', service.id)
    .neq('status', 'cancelled')
    .gte('start_time', new Date(target.getTime() - 60_000).toISOString())
    .lte('start_time', new Date(target.getTime() + 60_000).toISOString())
    .maybeSingle();

  return data;
}

export async function cancelBooking(ctx: ToolContext, args: { serviceName: string; date: string; time: string }) {
  const existing = await findOwnedBooking(ctx, args);
  if (!existing) return { error: 'Could not find a matching booking for that service, date, and time.' };
  if (existing.status === 'cancelled') return { error: 'That booking is already cancelled.' };

  const { data: rules } = await supabaseAdmin
    .from('booking_rules')
    .select('cancellation_window_hours')
    .eq('business_id', ctx.businessId)
    .maybeSingle();

  const windowHours = rules?.cancellation_window_hours ?? 24;
  const hoursUntilStart = (new Date(existing.start_time).getTime() - Date.now()) / 3600000;
  if (hoursUntilStart < windowHours) {
    return { error: `This booking can only be cancelled at least ${windowHours} hours in advance.` };
  }

  const { error } = await supabaseAdmin.from('bookings').update({ status: 'cancelled' }).eq('id', existing.id);
  if (error) return { error: error.message };
  return { cancelled: true };
}

export async function rescheduleBooking(
  ctx: ToolContext,
  args: { serviceName: string; date: string; time: string; newDate: string; newTime: string }
) {
  const existing = await findOwnedBooking(ctx, args);
  if (!existing) return { error: 'Could not find a matching booking for that service, date, and time.' };
  if (existing.status === 'cancelled') return { error: 'That booking is already cancelled.' };

  const [{ data: business }, { data: rules }] = await Promise.all([
    supabaseAdmin.from('businesses').select('timezone').eq('id', ctx.businessId).single(),
    supabaseAdmin
      .from('booking_rules')
      .select('buffer_minutes, max_advance_days, cancellation_window_hours')
      .eq('business_id', ctx.businessId)
      .maybeSingle(),
  ]);

  const timeZone = business?.timezone || 'UTC';
  const windowHours = rules?.cancellation_window_hours ?? 24;
  const hoursUntilStart = (new Date(existing.start_time).getTime() - Date.now()) / 3600000;
  if (hoursUntilStart < windowHours) {
    return { error: `This booking can only be rescheduled at least ${windowHours} hours in advance.` };
  }

  const duration = (existing.services as unknown as { duration_minutes: number } | null)?.duration_minutes ?? 30;
  const newStart = zonedTimeToUtc(args.newDate, args.newTime, timeZone);
  const newEnd = new Date(newStart.getTime() + duration * 60000);

  const today = todayInTimezone(timeZone);
  const maxAdvanceDays = rules?.max_advance_days ?? 30;
  const daysOut = daysBetween(today, args.newDate);
  if (daysOut < 0 || daysOut > maxAdvanceDays) return { error: 'That date is not available for booking.' };

  const bufferMinutes = rules?.buffer_minutes ?? 0;
  const { data: others } = await supabaseAdmin
    .from('bookings')
    .select('start_time, end_time')
    .eq('business_id', ctx.businessId)
    .neq('id', existing.id)
    .neq('status', 'cancelled');

  const overlaps = (others ?? []).some((b) => {
    const bStart = new Date(new Date(b.start_time).getTime() - bufferMinutes * 60000);
    const bEnd = new Date(new Date(b.end_time).getTime() + bufferMinutes * 60000);
    return newStart < bEnd && newEnd > bStart;
  });
  if (overlaps) return { error: 'That time is no longer available.' };

  const { data: updated, error } = await supabaseAdmin
    .from('bookings')
    .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23P01') return { error: 'That time is no longer available.' };
    return { error: error.message };
  }
  return { rescheduled: true, booking_id: updated.id, when: formatLocalDateTime(updated.start_time, timeZone) };
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function loadConversation(businessId: string, customerPhone: string): Promise<ChatMessage[]> {
  const { data } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('messages')
    .eq('business_id', businessId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();
  return (data?.messages as ChatMessage[]) ?? [];
}

export async function saveConversation(businessId: string, customerPhone: string, messages: ChatMessage[]) {
  await supabaseAdmin.from('whatsapp_conversations').upsert(
    {
      business_id: businessId,
      customer_phone: customerPhone,
      messages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'business_id,customer_phone' }
  );
}
