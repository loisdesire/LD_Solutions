import { createClient } from '@supabase/supabase-js';
import { getAvailableSlots } from './getAvailableSlots';
import { todayInTimezone, daysBetween, zonedTimeToUtc } from './timezone';
import { getBusinessTimezone } from './getBusinessTimezone';
import { formatLocalDateTime, formatLocalTime, to24Hour } from './formatDateTime';
import { sendEmail } from './email';
import { canAcceptBookings } from './subscription-server';
import { SITE_URL } from './site';
import { initializePaystackTransaction, verifyPaystackTransaction } from './paystack';
import { randomUUID } from 'crypto';

// Server-side only. This file has zero awareness of OpenAI, Anthropic, or
// Twilio - it's the same booking logic the web app already uses (services,
// availability, bookings), just exposed as functions an AI agent can call
// by name. lib/whatsappAgent.ts is the only place that knows which AI
// provider is calling these.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ToolContext = {
  businessId: string;
  // Opaque per-channel customer identifier - never model-supplied. WhatsApp
  // uses Twilio's 'whatsapp:+...' From field; Telegram uses 'telegram:<chatId>'.
  // Reusing the same bookings.customer_phone column across channels avoids a
  // schema change; it's just a stable "who to reply to" key, not validated
  // as an actual phone number anywhere in this codebase.
  customerPhone: string;
  // Telegram-only, and only when the customer has a public username set -
  // it's the one thing that makes a Telegram customer actually contactable
  // outside the bot (t.me/<username> opens a real chat; the numeric chat id
  // in customerPhone can't be turned into a clickable link on its own).
  customerUsername?: string;
};


// Meta's Cloud API webhook is shared across every number registered to the
// same App/WABA - unlike Telegram's per-bot URL, there's no per-business
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
  // contact_phone/contact_email/instagram_url/facebook_url are already
  // filled in by the business in Settings and shown on the public Contact
  // page - the AI just never actually got them, so "what's your phone
  // number" was unanswerable even though the business had already
  // provided one.
  const [{ data: business }, { data: services }, { data: hours }] = await Promise.all([
    supabaseAdmin
      .from('businesses')
      .select('id, name, timezone, contact_phone, contact_email, instagram_url, facebook_url')
      .eq('id', businessId)
      .single(),
    supabaseAdmin
      .from('services')
      .select('name, duration_minutes, price')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name'),
    // Business-wide hours only (staff_id is null) - enough for FAQ answers
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

  const timeZone = await getBusinessTimezone(ctx.businessId);

  const slots = await getAvailableSlots(ctx.businessId, service.id, args.date);

  return {
    service: service.name,
    duration_minutes: service.duration_minutes,
    price: service.price,
    date: args.date,
    // `label` is what to show the customer. `time_24h` is the exact value to
    // pass back as create_booking's `time` argument - no conversion needed
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
  if (!(await canAcceptBookings(ctx.businessId))) {
    return { error: "This business isn't currently accepting new bookings. Let the customer know to contact the business directly." };
  }

  const service = await findActiveService(ctx.businessId, args.serviceName);
  if (!service) return { error: `No service matching "${args.serviceName}" found.` };

  let [{ data: business }, { data: rules }] = await Promise.all([
    supabaseAdmin.from('businesses').select('slug, timezone, paystack_public_key, paystack_secret_key').eq('id', ctx.businessId).single(),
    supabaseAdmin.from('booking_rules').select('require_payment, deposit_percentage').eq('business_id', ctx.businessId).maybeSingle(),
  ]);

  // Same defensive fallback used everywhere the payments migration might
  // not have run yet on a given deployment - a select naming a
  // nonexistent column fails as a whole unit, so this re-queries with
  // just the columns that predate payments. `rules` needs no equivalent
  // fallback: whether it's null because there's genuinely no row yet, or
  // because require_payment doesn't exist as a column, `rules?.require_payment`
  // reads as falsy either way - exactly the safe "not required" default.
  if (business === null) {
    const fallback = await supabaseAdmin.from('businesses').select('slug, timezone').eq('id', ctx.businessId).single();
    if (fallback.data) business = { ...fallback.data, paystack_public_key: null, paystack_secret_key: null };
  }

  const timeZone = business?.timezone || 'UTC';

  // This tool used to insert a booking here with no idea whether the
  // business requires payment at all - a customer chatting through
  // WhatsApp/Telegram/web-chat could book a service completely free even
  // when the exact same service required payment upfront on the web
  // booking page (app/api/bookings/route.ts). There's no interactive
  // checkout inside a chat conversation to collect that payment, so the
  // fix isn't to collect it here - it's to never let this tool create an
  // unpaid booking for a service that requires one. Gated on
  // paystack_public_key specifically (not just the require_payment
  // toggle) to match the exact same condition the public booking page
  // uses to decide whether payment is actually active - a business that
  // switched the toggle on but never connected Paystack isn't actually
  // collecting payment anywhere, on this channel or the web one.
  // Paid services used to be refused outright here with a "book it on the
  // website" link - correct at the time (a chat has no popup checkout, and
  // letting this tool book a paid service free was the actual bug) but a
  // dead end in the conversation. Now the slot is held as 'pending_payment'
  // and the customer gets a hosted Paystack link they can open from the
  // chat. The hold is what makes this safe: it reserves the slot via the
  // same no_overlapping_bookings constraint a confirmed booking uses, so
  // nobody can take it while they pay, and it self-releases if they don't
  // (see expireStalePaymentHolds in getAvailableSlots).
  const paymentRequired = Boolean(rules?.require_payment && service.price && business?.paystack_public_key);

  if (paymentRequired && !business?.paystack_secret_key) {
    return { error: "This business hasn't finished setting up payments, so this service can't be booked here yet. Tell the customer to contact them directly." };
  }
  if (paymentRequired && !args.customerEmail) {
    return {
      needs_email: true,
      instructions: 'This service needs paying for before it can be booked, and Paystack requires an email address to send the receipt to. Ask the customer for their email, then call this tool again with it.',
    };
  }

  const start = zonedTimeToUtc(args.date, args.time, timeZone);
  const end = new Date(start.getTime() + service.duration_minutes * 60000);

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      business_id: ctx.businessId,
      service_id: service.id,
      status: paymentRequired ? 'pending_payment' : 'confirmed',
      payment_status: paymentRequired ? 'pending' : null,
      payment_expires_at: paymentRequired ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
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

  // Payment path: the slot is held but nothing is booked yet. Hand back a
  // hosted checkout link instead of a confirmation, and be explicit to the
  // model that this is NOT a confirmed booking - the single most damaging
  // thing it could do here is tell a customer they're booked when no money
  // has moved and the hold is about to lapse.
  if (paymentRequired) {
    const depositPct = rules?.deposit_percentage ?? 100;
    const amountNaira = Math.round(service.price! * (depositPct / 100));
    const reference = `chat_${booking.id}_${randomUUID().slice(0, 8)}`;

    const init = await initializePaystackTransaction({
      secretKey: business!.paystack_secret_key!,
      email: args.customerEmail!,
      amountKobo: amountNaira * 100,
      reference,
      bookingId: booking.id,
      callbackUrl: business?.slug ? `${SITE_URL}/${business.slug}` : undefined,
    });

    if (!init) {
      // Don't leave a hold sitting on a slot for a checkout that never
      // existed - release it immediately rather than waiting 15 minutes.
      await supabaseAdmin.from('bookings').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', booking.id);
      return { error: "Couldn't start the payment just now. Ask the customer to try again in a moment." };
    }

    await supabaseAdmin.from('bookings').update({ payment_reference: reference }).eq('id', booking.id);

    return {
      awaiting_payment: true,
      booking_id: booking.id,
      service: service.name,
      when: formatLocalDateTime(booking.start_time, timeZone),
      amount_naira: amountNaira,
      is_deposit: depositPct < 100,
      payment_url: init.authorizationUrl,
      holds_slot_for_minutes: 15,
      instructions:
        `Do NOT say the booking is confirmed - it is not. Tell the customer their ${service.name} slot at ` +
        `${formatLocalDateTime(booking.start_time, timeZone)} is held for 15 minutes, give them this exact link to pay ` +
        `₦${amountNaira.toLocaleString()}: ${init.authorizationUrl} - and tell them to message you once they have paid so you can confirm it. ` +
        `If they don't pay within 15 minutes the slot is released.`,
    };
  }

  // Same fire-and-forget confirmation email as the web booking flow
  // (app/api/bookings/route.ts) - failure here never blocks the booking.
  if (args.customerEmail) {
    await sendEmail(
      {
        to: args.customerEmail,
        subject: 'Your appointment is confirmed',
        html: `<p>Hi ${args.customerName}, your ${service.name} appointment is confirmed for ${formatLocalDateTime(booking.start_time, timeZone)}.</p>`,
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

// Business-Intelligence-plan-only, and deliberately much narrower than
// anything in lib/insightsTools.ts: service name and how often it's been
// booked, nothing else. No revenue, no per-customer data, nothing that
// identifies any other customer - this is reachable by anyone who can
// message the bot, unlike insightsTools.ts which only ever runs behind a
// staff session. Only wired into the tool list when the business is on the
// business_intelligence plan (see whatsappAgent.ts).
export async function getPopularServices(businessId: string, args: { limit?: number }) {
  const { data } = await supabaseAdmin
    .from('bookings')
    .select('services(name)')
    .eq('business_id', businessId)
    .neq('status', 'cancelled');

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const service = Array.isArray(row.services) ? row.services[0] : row.services;
    if (!service?.name) continue;
    counts.set(service.name, (counts.get(service.name) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, args.limit ?? 3);
  if (sorted.length === 0) return { popular_services: [] };
  return { popular_services: sorted.map(([name]) => name) };
}

// Confirms a held booking once the customer says they've paid. This is the
// no-setup path: the Paystack webhook is faster and needs no prompting,
// but it only fires for businesses that have pasted the webhook URL into
// their own Paystack dashboard, and many won't have. Verifying on demand
// works for everyone.
//
// Shares confirmPaidBooking with the webhook so both routes apply the
// identical amount check and idempotency rule.
export async function checkPayment(ctx: ToolContext) {
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, status, payment_reference, payment_status, start_time, services(name)')
    .eq('business_id', ctx.businessId)
    .eq('customer_phone', ctx.customerPhone)
    .in('status', ['pending_payment', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!booking) return { error: 'No recent booking found for this customer to check payment against.' };
  if (booking.status === 'confirmed') {
    return { already_confirmed: true, instructions: 'This booking is already confirmed - reassure the customer, do not ask them to pay again.' };
  }
  if (!booking.payment_reference) return { error: 'That booking has no payment attached to check.' };

  const result = await confirmPaidBooking(booking.id, booking.payment_reference);

  if (result.confirmed) {
    return { confirmed: true, when: result.when, instructions: 'Payment confirmed. Tell the customer their booking is now confirmed for this time.' };
  }
  if (result.reason === 'not_paid') {
    return {
      confirmed: false,
      instructions: "Paystack hasn't recorded that payment yet. Tell the customer it may take a moment, and to try the link again if they haven't completed it.",
    };
  }
  if (result.reason === 'slot_taken') {
    return {
      confirmed: false,
      slot_taken: true,
      alternatives: result.alternatives,
      instructions:
        'Their payment went through but the hold had already lapsed and the slot was taken. Apologise clearly, say the ' +
        'business has been notified and will sort out their payment, and offer the alternative times listed.',
    };
  }
  return { confirmed: false, instructions: "Couldn't verify that payment. Ask the customer to contact the business directly." };
}

// The one place a held booking becomes a real one. Both the webhook and
// check_payment go through here so the amount check, the expiry check and
// the idempotency rule can't drift apart between them.
export async function confirmPaidBooking(
  bookingId: string,
  reference: string
): Promise<{ confirmed: boolean; when?: string; reason?: string; alternatives?: string[] }> {
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, business_id, service_id, status, start_time, end_time, payment_expires_at')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return { confirmed: false, reason: 'not_found' };

  const timeZone = await getBusinessTimezone(booking.business_id);

  // Already done - a customer paying twice on the same link, or the webhook
  // and check_payment both landing, must not double-confirm or re-charge.
  if (booking.status === 'confirmed') {
    return { confirmed: true, when: formatLocalDateTime(booking.start_time, timeZone) };
  }

  const [{ data: business }, { data: rules }, { data: service }] = await Promise.all([
    supabaseAdmin.from('businesses').select('paystack_secret_key').eq('id', booking.business_id).single(),
    supabaseAdmin.from('booking_rules').select('deposit_percentage').eq('business_id', booking.business_id).maybeSingle(),
    supabaseAdmin.from('services').select('price, name').eq('id', booking.service_id).maybeSingle(),
  ]);

  if (!business?.paystack_secret_key) return { confirmed: false, reason: 'not_configured' };

  const verified = await verifyPaystackTransaction(business.paystack_secret_key, reference);
  if (!verified || verified.status !== 'success') return { confirmed: false, reason: 'not_paid' };

  // Never trust an amount reported to us - recompute what was owed and
  // compare against what Paystack says actually settled.
  const expectedKobo = Math.round((service?.price ?? 0) * ((rules?.deposit_percentage ?? 100) / 100)) * 100;
  if (Math.abs(verified.amount - expectedKobo) > 200) return { confirmed: false, reason: 'amount_mismatch' };

  const amountPaid = Math.round(verified.amount / 100);

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'confirmed', payment_status: 'paid', amount_paid: amountPaid, payment_expires_at: null })
    .eq('id', booking.id)
    .eq('status', 'pending_payment');

  if (error) {
    // 23P01 here means the hold lapsed, the sweep cancelled it, and
    // somebody else has since taken the slot - so this booking can't be
    // revived. The customer HAS paid, so this must never fail silently:
    // it stays cancelled-but-paid for the business to see and settle.
    if ((error as { code?: string }).code === '23P01') {
      await supabaseAdmin
        .from('bookings')
        .update({ payment_status: 'paid_slot_lost', amount_paid: amountPaid })
        .eq('id', booking.id);
      const dateISO = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(booking.start_time));
      const slots = await getAvailableSlots(booking.business_id, booking.service_id, dateISO);
      return {
        confirmed: false,
        reason: 'slot_taken',
        alternatives: slots.slice(0, 5).map((iso) => formatLocalDateTime(iso, timeZone)),
      };
    }
    return { confirmed: false, reason: 'update_failed' };
  }

  return { confirmed: true, when: formatLocalDateTime(booking.start_time, timeZone) };
}

export async function findCustomerBookings(ctx: ToolContext) {
  const timeZone = await getBusinessTimezone(ctx.businessId);

  // payment_status/amount_paid let the bot actually answer "did my
  // deposit go through" instead of having nothing to check - same
  // defensive fallback as every other payments-column read this session,
  // since a business that never ran that migration would otherwise fail
  // this whole query (and with it, cancel/reschedule, which both call
  // this same tool's underlying lookup pattern) rather than just not
  // having payment info to show.
  let { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, start_time, status, payment_status, amount_paid, services(name)')
    .eq('business_id', ctx.businessId)
    .eq('customer_phone', ctx.customerPhone)
    .neq('status', 'cancelled')
    .gte('start_time', new Date().toISOString())
    .order('start_time');

  if (error?.code === '42703') {
    const fallback = await supabaseAdmin
      .from('bookings')
      .select('id, start_time, status, services(name)')
      .eq('business_id', ctx.businessId)
      .eq('customer_phone', ctx.customerPhone)
      .neq('status', 'cancelled')
      .gte('start_time', new Date().toISOString())
      .order('start_time');
    data = (fallback.data ?? []).map((b) => ({ ...b, payment_status: null, amount_paid: null }));
  }

  return {
    // No id exposed here on purpose - cancel/reschedule identify a booking
    // by service + date + time (which the model tracks reliably from natural
    // conversation), not by asking the model to transcribe a UUID it saw in
    // a previous turn. `when` is the only time representation given here too,
    // so there's nothing left for it to (mis)calculate either.
    bookings: (data ?? []).map((b: any) => ({
      service: (b.services as unknown as { name: string } | null)?.name,
      when: formatLocalDateTime(b.start_time, timeZone),
      status: b.status,
      paid: b.payment_status === 'paid' ? true : b.payment_status ? false : null,
      amount_paid: b.amount_paid ?? null,
    })),
  };
}

// Cancel/reschedule identify the booking by service + date + time rather
// than a raw booking id. A per-turn conversation only carries forward
// human-readable text (see loadConversation/saveConversation below), not
// prior tool results, so a model-transcribed UUID from a find_customer_
// bookings call several turns back is exactly the kind of thing an LLM
// garbles - a copy error there silently looks identical to "not found".
// Service + date + time is what the model naturally tracks correctly in
// conversation anyway, so this removes that failure mode entirely.
async function findOwnedBooking(ctx: ToolContext, args: { serviceName: string; date: string; time: string }) {
  const service = await findActiveService(ctx.businessId, args.serviceName);
  if (!service) return null;

  const timeZone = await getBusinessTimezone(ctx.businessId);

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

  const [timeZone, { data: rules }] = await Promise.all([
    getBusinessTimezone(ctx.businessId),
    supabaseAdmin
      .from('booking_rules')
      .select('buffer_minutes, max_advance_days, cancellation_window_hours')
      .eq('business_id', ctx.businessId)
      .maybeSingle(),
  ]);

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
