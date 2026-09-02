import { createClient } from '@supabase/supabase-js';
import { formatMoney } from './formatMoney';
import { getBusinessTimezone } from './getBusinessTimezone';
import { to24Hour, formatLocalDateTime } from './formatDateTime';
import { verifyBusinessMediaUrl } from './verifyBusinessMediaUrl';
import { sendEmail } from './email';
import { renderEmail } from './emailTemplate';

// Owner-facing, write-capable - "manage your business by chat" instead of
// the Services form and the Settings toggles. Same two-step shape as
// rescheduleTools.ts and the same reason for it: propose_* only ever reads
// and computes, it never writes; apply_* is the only thing that touches a
// real row, and the system prompt in lib/assistantAgent.ts is what actually
// enforces that apply_* only runs once the owner has said yes to the exact
// plan propose_* returned. Kept deliberately narrow for a first pass -
// create and edit a service, toggle what's visible - not delete, not
// staff, not pricing rules. Those are real capabilities still locked
// behind the real forms on purpose.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.length <= MAX_NAME_LENGTH ? cleaned : null;
}

function cleanDescription(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned.length <= MAX_DESCRIPTION_LENGTH ? cleaned : undefined;
}

// Only ever accepts a URL this same business's own upload just produced
// (Supabase Storage's public bucket, under this business's own folder) -
// never an arbitrary string the model might otherwise be talked into
// inventing or pulling from somewhere else. Was an inline exact-host-
// string-equality check against process.env.NEXT_PUBLIC_SUPABASE_URL,
// duplicated three times across this file and both chat routes - fragile
// by construction, and confirmed live as the actual cause of "there was
// an issue with the logo file"/"I don't see an attachment" errors on
// genuinely-uploaded photos (see lib/verifyBusinessMediaUrl.ts for the
// full story). null/undefined here keep this function's existing
// three-state contract (null = no image given, undefined = given but
// invalid) - only the validation itself moved.
function cleanImageUrl(value: unknown, businessId: string): string | null | undefined {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  return verifyBusinessMediaUrl(value, businessId) ?? undefined;
}

function cleanDuration(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 5 && n <= 480 ? Math.round(n) : null;
}

// Distinct from "invalid" - a service with no price at all is a real,
// supported state (ServicesManager's own "Ask for pricing" case), so
// omitting price entirely must not be treated the same as a bad value.
function cleanPrice(value: unknown): number | null | undefined {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : undefined;
}

// A SELECT of a genuinely nonexistent column fails with Postgres's own raw
// 42703 error; an INSERT/UPDATE with an unrecognized key in the JSON
// payload never reaches Postgres at all - PostgREST checks it against its
// own cached schema first and fails with PGRST204 instead. Both mean the
// same real-world thing (the services.description/image_url/category
// migration hasn't been run against this database yet), so every fallback
// below has to check for both codes, not just one.
function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

async function findServiceByName(businessId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('id, name, duration_minutes, price, description, image_url, category, active')
    .eq('business_id', businessId)
    .ilike('name', `%${name}%`)
    .order('active', { ascending: false })
    .limit(5);

  // 42703 = the services.description/image_url/category migration
  // (supabase/schema.sql) hasn't been run against this database yet - a
  // combined select fails as one unit on ANY missing column, which would
  // otherwise take down every service lookup (create, update, toggle) at
  // once. Falls back to the columns that do exist so the rest of "manage
  // your business by chat" keeps working; the caller just won't see a
  // description/photo/category for now.
  if (isMissingColumnError(error)) {
    const fallback = await supabaseAdmin
      .from('services')
      .select('id, name, duration_minutes, price, active')
      .eq('business_id', businessId)
      .ilike('name', `%${name}%`)
      .order('active', { ascending: false })
      .limit(5);
    return (fallback.data ?? []).map((s) => ({ ...s, description: null as string | null, image_url: null as string | null, category: null as string | null }));
  }

  return data ?? [];
}

export async function proposeCreateService(
  businessId: string,
  args: { name: unknown; durationMinutes: unknown; price: unknown; description?: unknown; imageUrl?: unknown; category?: unknown }
) {
  const name = cleanName(args.name);
  const durationMinutes = cleanDuration(args.durationMinutes);
  const price = cleanPrice(args.price);
  const description = cleanDescription(args.description);
  const imageUrl = cleanImageUrl(args.imageUrl, businessId);

  if (!name) return { error: 'Give this service a real name (1-100 characters).' };
  if (!durationMinutes) return { error: 'Duration needs to be a real number of minutes, between 5 and 480.' };
  if (price === undefined) return { error: "That price doesn't look right - give a plain number, or leave it out entirely for \"ask for pricing\"." };
  if (description === undefined) return { error: `Description is too long - keep it under ${MAX_DESCRIPTION_LENGTH} characters.` };
  if (imageUrl === undefined) return { error: "That image doesn't look like one uploaded through this chat - ask them to attach it again." };

  const { data: existing } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('business_id', businessId)
    .ilike('name', name)
    .maybeSingle();

  return {
    already_exists: Boolean(existing),
    proposed: {
      name,
      duration_minutes: durationMinutes,
      price: price != null ? formatMoney(price) : 'Ask for pricing (no price set)',
      description: description ?? 'None',
      has_image: Boolean(imageUrl),
      category: typeof args.category === 'string' && args.category.trim() ? args.category.trim() : 'None',
    },
    note: existing
      ? 'A service with this name already exists - creating another will make two with the same name. Confirm the owner really wants a duplicate, or suggest editing the existing one instead.'
      : undefined,
  };
}

export async function applyCreateService(
  businessId: string,
  args: { name: unknown; durationMinutes: unknown; price: unknown; description?: unknown; imageUrl?: unknown; category?: unknown }
) {
  const name = cleanName(args.name);
  const durationMinutes = cleanDuration(args.durationMinutes);
  const price = cleanPrice(args.price);
  const description = cleanDescription(args.description);
  const imageUrl = cleanImageUrl(args.imageUrl, businessId);

  if (!name || !durationMinutes || price === undefined || description === undefined || imageUrl === undefined) {
    return { error: 'One of those values changed or was invalid since it was proposed - propose it again before applying.' };
  }

  let { data, error } = await supabaseAdmin
    .from('services')
    .insert({
      business_id: businessId,
      name,
      duration_minutes: durationMinutes,
      price,
      description,
      image_url: imageUrl,
      category: typeof args.category === 'string' && args.category.trim() ? args.category.trim() : null,
    })
    .select('id, name')
    .single();

  // Same missing-column fallback as findServiceByName above - the service itself
  // (name, duration, price, all it needs to be bookable) still gets
  // created; only the description/photo/category are dropped, and the
  // caller is told plainly rather than silently losing them.
  let droppedExtras = false;
  if (isMissingColumnError(error)) {
    const fallback = await supabaseAdmin
      .from('services')
      .insert({ business_id: businessId, name, duration_minutes: durationMinutes, price })
      .select('id, name')
      .single();
    data = fallback.data;
    error = fallback.error;
    droppedExtras = !error && (description != null || imageUrl != null || Boolean(args.category));
  }

  if (error) return { error: "That didn't save - please try again." };
  return {
    created: true,
    service_id: data!.id,
    name: data!.name,
    ...(droppedExtras
      ? { note: "The service itself saved, but the description/photo/category couldn't - a pending database update needs to be run first. Tell the owner the service was created and that part can be added once that's done." }
      : {}),
  };
}

export async function proposeUpdateService(
  businessId: string,
  args: { serviceName: unknown; changes: Record<string, unknown> }
) {
  const searchName = cleanName(args.serviceName);
  if (!searchName) return { error: 'Which service? Give a real name to search for.' };

  const matches = await findServiceByName(businessId, searchName);
  if (matches.length === 0) return { error: `No service matching "${searchName}" was found.` };
  if (matches.length > 1) {
    return {
      needs_disambiguation: true,
      matches: matches.map((m) => ({ name: m.name, active: m.active, price: m.price != null ? formatMoney(m.price) : 'unpriced' })),
    };
  }

  const current = matches[0];
  const changes = args.changes ?? {};
  const proposed: Record<string, { from: string; to: string }> = {};

  if (changes.name !== undefined) {
    const v = cleanName(changes.name);
    if (!v) return { error: 'The new name is invalid.' };
    if (v !== current.name) proposed.name = { from: current.name, to: v };
  }
  if (changes.durationMinutes !== undefined) {
    const v = cleanDuration(changes.durationMinutes);
    if (!v) return { error: 'The new duration is invalid - minutes between 5 and 480.' };
    if (v !== current.duration_minutes) proposed.duration_minutes = { from: `${current.duration_minutes} min`, to: `${v} min` };
  }
  if (changes.price !== undefined) {
    const v = cleanPrice(changes.price);
    if (v === undefined) return { error: 'That price is invalid.' };
    proposed.price = { from: current.price != null ? formatMoney(current.price) : 'unpriced', to: v != null ? formatMoney(v) : 'unpriced' };
  }
  if (changes.description !== undefined) {
    const v = cleanDescription(changes.description);
    if (v === undefined) return { error: 'That description is too long.' };
    proposed.description = { from: current.description ?? 'none', to: v ?? 'none' };
  }
  if (changes.imageUrl !== undefined) {
    const v = cleanImageUrl(changes.imageUrl, businessId);
    if (v === undefined) return { error: "That image doesn't look like one uploaded through this chat." };
    proposed.image = { from: current.image_url ? 'has a photo' : 'no photo', to: v ? 'new photo attached' : 'no photo' };
  }
  if (changes.active !== undefined) {
    const v = Boolean(changes.active);
    if (v !== current.active) proposed.visible = { from: current.active ? 'visible' : 'hidden', to: v ? 'visible' : 'hidden' };
  }

  if (Object.keys(proposed).length === 0) return { error: 'No real changes given - nothing would actually change.' };

  return { service_name: current.name, changes: proposed };
}

export async function applyUpdateService(
  businessId: string,
  args: { serviceName: unknown; changes: Record<string, unknown> }
) {
  const searchName = cleanName(args.serviceName);
  if (!searchName) return { error: 'Which service? Give a real name to search for.' };

  const matches = await findServiceByName(businessId, searchName);
  if (matches.length !== 1) {
    return { error: matches.length === 0 ? 'That service was not found.' : 'More than one service matches that name - propose the change again to disambiguate.' };
  }
  const current = matches[0];
  const changes = args.changes ?? {};
  const update: Record<string, unknown> = {};

  if (changes.name !== undefined) {
    const v = cleanName(changes.name);
    if (!v) return { error: 'Invalid name.' };
    update.name = v;
  }
  if (changes.durationMinutes !== undefined) {
    const v = cleanDuration(changes.durationMinutes);
    if (!v) return { error: 'Invalid duration.' };
    update.duration_minutes = v;
  }
  if (changes.price !== undefined) {
    const v = cleanPrice(changes.price);
    if (v === undefined) return { error: 'Invalid price.' };
    update.price = v;
  }
  if (changes.description !== undefined) {
    const v = cleanDescription(changes.description);
    if (v === undefined) return { error: 'Invalid description.' };
    update.description = v;
  }
  if (changes.imageUrl !== undefined) {
    const v = cleanImageUrl(changes.imageUrl, businessId);
    if (v === undefined) return { error: 'Invalid image.' };
    update.image_url = v;
  }
  if (changes.active !== undefined) {
    update.active = Boolean(changes.active);
  }

  if (Object.keys(update).length === 0) return { error: 'Nothing to update.' };

  let { error } = await supabaseAdmin.from('services').update(update).eq('id', current.id).eq('business_id', businessId);

  // Same missing-column fallback as findServiceByName/applyCreateService - if the
  // only things being changed were description/image, there's nothing left
  // to retry; otherwise apply everything else and say plainly what didn't
  // stick.
  let droppedExtras = false;
  if (isMissingColumnError(error)) {
    const { description: _d, image_url: _i, ...rest } = update;
    if (Object.keys(rest).length > 0) {
      const fallback = await supabaseAdmin.from('services').update(rest).eq('id', current.id).eq('business_id', businessId);
      error = fallback.error;
      droppedExtras = !error;
    } else {
      return { error: "The description/photo can't be saved yet - a pending database update needs to be run first. Tell the owner, and skip this change for now." };
    }
  }

  if (error) return { error: "That didn't save - please try again." };
  return {
    updated: true,
    name: (update.name as string) ?? current.name,
    ...(droppedExtras
      ? { note: "Everything else saved, but the description/photo couldn't - a pending database update needs to be run first. Tell the owner." }
      : {}),
  };
}

const TOGGLE_TABLE: Record<string, 'businesses' | 'booking_rules'> = {
  about: 'businesses',
  gallery: 'businesses',
  contact: 'businesses',
  payment: 'booking_rules',
};
const TOGGLE_COLUMN: Record<string, string> = {
  about: 'show_about',
  gallery: 'show_gallery',
  contact: 'show_contact',
  payment: 'require_payment',
};
const TOGGLE_LABEL: Record<string, string> = {
  about: 'the About page',
  gallery: 'the Gallery page',
  contact: 'the Contact page',
  payment: 'requiring payment to confirm a booking',
};

function validSetting(value: unknown): value is keyof typeof TOGGLE_TABLE {
  return typeof value === 'string' && value in TOGGLE_TABLE;
}

export async function proposeToggleSetting(businessId: string, args: { setting: unknown; enabled: unknown }) {
  if (!validSetting(args.setting)) return { error: 'Unknown setting - it can toggle the About page, Gallery page, Contact page, or requiring payment.' };
  const enabled = Boolean(args.enabled);

  if (args.setting === 'payment' && enabled) {
    const { data: business } = await supabaseAdmin.from('businesses').select('paystack_secret_key').eq('id', businessId).maybeSingle();
    if (!business?.paystack_secret_key) {
      return { error: "Payments can't be turned on yet - no Paystack account is connected. That has to be done from Settings > Payments first, this chat can't paste in a secret key." };
    }
  }

  return {
    setting: args.setting,
    will_become: `${TOGGLE_LABEL[args.setting]} will be turned ${enabled ? 'ON' : 'OFF'}`,
  };
}

export async function applyToggleSetting(businessId: string, args: { setting: unknown; enabled: unknown }) {
  if (!validSetting(args.setting)) return { error: 'Unknown setting.' };
  const enabled = Boolean(args.enabled);
  const table = TOGGLE_TABLE[args.setting];
  const column = TOGGLE_COLUMN[args.setting];

  if (args.setting === 'payment' && enabled) {
    const { data: business } = await supabaseAdmin.from('businesses').select('paystack_secret_key').eq('id', businessId).maybeSingle();
    if (!business?.paystack_secret_key) return { error: 'No Paystack account connected - cannot turn payments on.' };
  }

  const query =
    table === 'businesses'
      ? supabaseAdmin.from('businesses').update({ [column]: enabled }).eq('id', businessId)
      : supabaseAdmin.from('booking_rules').update({ [column]: enabled }).eq('business_id', businessId);

  const { error } = await query;
  if (error) return { error: "That didn't save - please try again." };
  return { applied: true, setting: args.setting, enabled };
}

// --- Business profile ------------------------------------------------

const MAX_PROFILE_DESCRIPTION = 160; // matches BusinessProfileManager.tsx's own limit
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function cleanAccentColor(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return HEX_COLOR_RE.test(cleaned) ? cleaned : undefined;
}

type ProfileChanges = { name?: unknown; description?: unknown; logoUrl?: unknown; coverImageUrl?: unknown; accentColor?: unknown };

export async function proposeUpdateProfile(businessId: string, changes: ProfileChanges) {
  const { data: current } = await supabaseAdmin
    .from('businesses')
    .select('name, description, logo_url, cover_image_url, accent_color')
    .eq('id', businessId)
    .single();
  if (!current) return { error: 'Could not load the current business profile.' };

  const proposed: Record<string, { from: string; to: string }> = {};

  if (changes.name !== undefined) {
    const v = cleanName(changes.name);
    if (!v) return { error: 'Invalid business name.' };
    if (v !== current.name) proposed.name = { from: current.name, to: v };
  }
  if (changes.description !== undefined) {
    const v = cleanDescription(changes.description);
    if (v === undefined) return { error: `Description is too long - keep it under ${MAX_PROFILE_DESCRIPTION} characters, it shows at the top of the booking page.` };
    proposed.description = { from: current.description ?? 'none', to: v ?? 'none' };
  }
  if (changes.logoUrl !== undefined) {
    const v = cleanImageUrl(changes.logoUrl, businessId);
    if (v === undefined) return { error: "That doesn't look like a photo uploaded through this chat." };
    proposed.logo = { from: current.logo_url ? 'has a logo' : 'no logo', to: 'new logo attached' };
  }
  if (changes.coverImageUrl !== undefined) {
    const v = cleanImageUrl(changes.coverImageUrl, businessId);
    if (v === undefined) return { error: "That doesn't look like a photo uploaded through this chat." };
    proposed.cover_photo = { from: current.cover_image_url ? 'has a cover photo' : 'no cover photo', to: 'new cover photo attached' };
  }
  if (changes.accentColor !== undefined) {
    const v = cleanAccentColor(changes.accentColor);
    if (v === undefined) return { error: 'That needs to be a real hex color, like #C74A1E.' };
    if (v !== current.accent_color) proposed.accent_color = { from: current.accent_color, to: v };
  }

  if (Object.keys(proposed).length === 0) return { error: 'No real changes given.' };
  return { changes: proposed };
}

export async function applyUpdateProfile(businessId: string, changes: ProfileChanges) {
  const update: Record<string, unknown> = {};

  if (changes.name !== undefined) {
    const v = cleanName(changes.name);
    if (!v) return { error: 'Invalid name.' };
    update.name = v;
  }
  if (changes.description !== undefined) {
    const v = cleanDescription(changes.description);
    if (v === undefined) return { error: 'Invalid description.' };
    update.description = v;
  }
  if (changes.logoUrl !== undefined) {
    const v = cleanImageUrl(changes.logoUrl, businessId);
    if (v === undefined) return { error: 'Invalid logo image.' };
    update.logo_url = v;
  }
  if (changes.coverImageUrl !== undefined) {
    const v = cleanImageUrl(changes.coverImageUrl, businessId);
    if (v === undefined) return { error: 'Invalid cover image.' };
    update.cover_image_url = v;
  }
  if (changes.accentColor !== undefined) {
    const v = cleanAccentColor(changes.accentColor);
    if (v === undefined) return { error: 'Invalid accent color.' };
    update.accent_color = v;
  }

  if (Object.keys(update).length === 0) return { error: 'Nothing to update.' };

  const { error } = await supabaseAdmin.from('businesses').update(update).eq('id', businessId);
  if (error) return { error: "That didn't save - please try again." };
  return { updated: true };
}

// --- Booking rules (buffer time between appointments, deposit %) -------
// Added for the onboarding flow specifically - it could tell an owner
// their booking page was "ready" without ever having a way to ask about
// buffer time or a deposit percentage at all, since neither had a tool
// here yet. Both were previously form-only (BookingRulesManager /
// PaymentsManager); this is the same booking_rules row, just reachable
// from chat now too - so the regular ongoing assistant picks this up
// automatically as well, not just onboarding.

type BookingRuleChanges = { bufferMinutes?: unknown; depositPercentage?: unknown };

function cleanBufferMinutes(value: unknown): number | null | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  return rounded >= 0 && rounded <= 180 ? rounded : undefined;
}

// 100 means "pay in full" (matches PaymentsManager.tsx's own convention -
// see its isDeposit ? depositPercentage : 100), not "invalid".
function cleanDepositPercentage(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 100 ? rounded : undefined;
}

export async function proposeUpdateBookingRules(businessId: string, changes: BookingRuleChanges) {
  const { data: current } = await supabaseAdmin
    .from('booking_rules')
    .select('buffer_minutes, deposit_percentage, require_payment')
    .eq('business_id', businessId)
    .maybeSingle();

  const proposed: Record<string, { from: string; to: string }> = {};

  if (changes.bufferMinutes !== undefined) {
    const v = cleanBufferMinutes(changes.bufferMinutes);
    if (v === undefined) return { error: 'Buffer time needs to be a number of minutes between 0 and 180.' };
    proposed.buffer_minutes = { from: `${current?.buffer_minutes ?? 0} min`, to: `${v} min` };
  }
  if (changes.depositPercentage !== undefined) {
    const v = cleanDepositPercentage(changes.depositPercentage);
    if (v === undefined) return { error: 'Deposit needs to be a percentage between 1 and 100 (100 means paid in full).' };
    // Setting a deposit percentage means nothing if payment isn't even
    // required yet - steer to the real prerequisite instead of silently
    // saving a percentage that has no effect on anything.
    if (!current?.require_payment) {
      return {
        error:
          "Payment isn't turned on for this business yet, so a deposit percentage wouldn't do anything. Turn payment on first (propose_toggle_setting with setting: \"payment\"), then set the deposit.",
      };
    }
    proposed.deposit_percentage = {
      from: current?.deposit_percentage ? `${current.deposit_percentage}%` : 'not set (full payment)',
      to: v === 100 ? 'full payment' : `${v}% deposit`,
    };
  }

  if (Object.keys(proposed).length === 0) return { error: 'No real changes given.' };
  return { changes: proposed };
}

export async function applyUpdateBookingRules(businessId: string, changes: BookingRuleChanges) {
  const update: Record<string, unknown> = {};

  if (changes.bufferMinutes !== undefined) {
    const v = cleanBufferMinutes(changes.bufferMinutes);
    if (v === undefined) return { error: 'Invalid buffer time.' };
    update.buffer_minutes = v;
  }
  if (changes.depositPercentage !== undefined) {
    const v = cleanDepositPercentage(changes.depositPercentage);
    if (v === undefined) return { error: 'Invalid deposit percentage.' };
    update.deposit_percentage = v;
  }

  if (Object.keys(update).length === 0) return { error: 'Nothing to update.' };

  const { error } = await supabaseAdmin.from('booking_rules').update(update).eq('business_id', businessId);
  if (error) return { error: "That didn't save - please try again." };
  return { updated: true };
}

// --- Hours -------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function cleanDayOfWeek(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
}

function cleanHourString(value: unknown): string | null {
  return typeof value === 'string' && HOUR_RE.test(value) ? value : null;
}

// Bookings up to 90 days out are worth checking - far enough that a real
// hours change (e.g. "we're closed Sundays from now on") catches whatever
// is actually already booked into the new dead zone, without scanning a
// business's entire multi-year booking history for a same-day settings
// tweak.
const CONFLICT_WINDOW_DAYS = 90;

async function findHoursConflicts(businessId: string, dayOfWeek: number, newStart: string | null, newEnd: string | null) {
  const timeZone = await getBusinessTimezone(businessId);
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('customer_name, start_time')
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .gte('start_time', new Date().toISOString())
    .lte('start_time', new Date(Date.now() + CONFLICT_WINDOW_DAYS * 86400000).toISOString());

  const conflicts: { customer_name: string; when: string }[] = [];
  for (const b of bookings ?? []) {
    // Read the weekday name straight out of Intl for this timezone, same
    // pattern insightsTools.ts already uses - re-parsing a formatted date
    // string back through `new Date(...)` to get its day number is exactly
    // the kind of locale-fragile round-trip that quietly breaks depending
    // on the runtime's default locale/timezone, since the server's own
    // clock has nothing to do with the business's timezone.
    const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(new Date(b.start_time));
    const localDow = DAY_NAMES.indexOf(weekdayName);
    if (localDow !== dayOfWeek) continue;

    const localTime = to24Hour(b.start_time, timeZone);
    const outsideNewWindow = !newStart || !newEnd || localTime < newStart || localTime >= newEnd;
    if (outsideNewWindow) {
      conflicts.push({ customer_name: b.customer_name, when: formatLocalDateTime(b.start_time, timeZone) });
    }
  }
  return conflicts;
}

export async function proposeUpdateHours(
  businessId: string,
  args: { dayOfWeek: unknown; startTime?: unknown; endTime?: unknown; closed?: unknown }
) {
  const dayOfWeek = cleanDayOfWeek(args.dayOfWeek);
  if (dayOfWeek === null) return { error: 'Which day? Give a day of the week.' };

  const closed = Boolean(args.closed);
  let startTime: string | null = null;
  let endTime: string | null = null;
  if (!closed) {
    startTime = cleanHourString(args.startTime);
    endTime = cleanHourString(args.endTime);
    if (!startTime || !endTime) return { error: 'Give both an opening and closing time, 24-hour HH:MM.' };
    if (endTime <= startTime) return { error: 'Closing time has to be after opening time.' };
  }

  const { data: existingRows } = await supabaseAdmin
    .from('availability')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .eq('day_of_week', dayOfWeek)
    .is('staff_id', null)
    .order('start_time');

  const currentLabel =
    existingRows && existingRows.length > 0
      ? existingRows.map((r) => `${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`).join(', ')
      : 'closed';
  const proposedLabel = closed ? 'closed' : `${startTime}-${endTime}`;

  const conflicts = await findHoursConflicts(businessId, dayOfWeek, startTime, endTime);

  return {
    day: DAY_NAMES[dayOfWeek],
    from: currentLabel,
    to: proposedLabel,
    conflicting_bookings: conflicts.length > 0 ? conflicts : undefined,
    note:
      conflicts.length > 0
        ? "These existing bookings will NOT be moved or cancelled automatically - they'll just sit outside the new hours. Tell the owner plainly and let them decide whether to proceed, reschedule those first, or pick different hours."
        : undefined,
  };
}

export async function applyUpdateHours(
  businessId: string,
  args: { dayOfWeek: unknown; startTime?: unknown; endTime?: unknown; closed?: unknown }
) {
  const dayOfWeek = cleanDayOfWeek(args.dayOfWeek);
  if (dayOfWeek === null) return { error: 'Which day? Give a day of the week.' };

  const closed = Boolean(args.closed);
  let startTime: string | null = null;
  let endTime: string | null = null;
  if (!closed) {
    startTime = cleanHourString(args.startTime);
    endTime = cleanHourString(args.endTime);
    if (!startTime || !endTime || endTime <= startTime) return { error: 'Invalid hours - propose this again.' };
  }

  // Same delete-then-insert shape as HoursManager.tsx's own save, so the
  // AI path and the manual form never disagree about how a day's hours
  // are represented on this table.
  const { error: deleteError } = await supabaseAdmin
    .from('availability')
    .delete()
    .eq('business_id', businessId)
    .eq('day_of_week', dayOfWeek)
    .is('staff_id', null);
  if (deleteError) return { error: "That didn't save - please try again." };

  if (!closed) {
    const { error: insertError } = await supabaseAdmin.from('availability').insert({
      business_id: businessId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    });
    if (insertError) return { error: "That didn't save - please try again." };
  }

  return { applied: true, day: DAY_NAMES[dayOfWeek], now: closed ? 'closed' : `${startTime}-${endTime}` };
}

function cleanReminderMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.length <= 500 ? cleaned : null;
}

// The model resolves "tomorrow at 2pm" into an exact ISO datetime itself
// (see the propose_create_reminder tool description) - this only checks
// what comes back is a real, parseable moment that's actually still ahead
// of now. A time already in the past would just fire on the cron's very
// next tick, which is never what was actually meant if the model got the
// date wrong.
function cleanRemindAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return null;
  return d.toISOString();
}

export async function proposeCreateReminder(businessId: string, args: { message: unknown; remindAt: unknown }) {
  const message = cleanReminderMessage(args.message);
  const remindAt = cleanRemindAt(args.remindAt);
  if (!message) return { error: 'Give a real reminder message (1-500 characters).' };
  if (!remindAt) return { error: "That time doesn't look right - it needs to be a real moment still ahead of now." };

  const timeZone = await getBusinessTimezone(businessId);
  return { proposed: { message, remind_at: formatLocalDateTime(remindAt, timeZone) } };
}

export async function applyCreateReminder(businessId: string, args: { message: unknown; remindAt: unknown }) {
  const message = cleanReminderMessage(args.message);
  const remindAt = cleanRemindAt(args.remindAt);
  if (!message || !remindAt) {
    return { error: 'One of those values changed or was invalid since it was proposed - propose it again before applying.' };
  }

  // staff_id deliberately left unset - who specifically asked isn't
  // threaded down through the agent call chain yet, and delivery below
  // goes to the whole business's notification-enabled devices regardless
  // (same reach notifyStaffOfNewBooking already uses), not one specific
  // person, so it isn't blocking anything to leave it null for now.
  const { error } = await supabaseAdmin.from('owner_reminders').insert({
    business_id: businessId,
    message,
    remind_at: remindAt,
  });
  if (error) return { error: "That didn't save - please try again." };

  const timeZone = await getBusinessTimezone(businessId);
  return { applied: true, message, remind_at: formatLocalDateTime(remindAt, timeZone) };
}

// There's no separate `customers` table - identity only ever lives on the
// bookings a person actually made, so "find a customer by name" means
// "find the most recent booking(s) with a matching name and read their
// contact info off it." Deduped by email (not by name - two different
// "Chioma"s are two different people, one "Chioma" who once mistyped her
// email is still one person, best represented by whichever email she used
// most recently).
async function findCustomerByName(businessId: string, name: string): Promise<{ name: string; email: string | null }[]> {
  const { data } = await supabaseAdmin
    .from('bookings')
    .select('customer_name, customer_email, start_time')
    .eq('business_id', businessId)
    .ilike('customer_name', `%${name}%`)
    .order('start_time', { ascending: false })
    .limit(30);

  const seen = new Map<string, { name: string; email: string | null }>();
  for (const row of data ?? []) {
    const key = row.customer_email ?? `no-email:${row.customer_name.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, { name: row.customer_name, email: row.customer_email });
  }
  return [...seen.values()];
}

function cleanEmailSubject(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.length <= 150 ? cleaned : null;
}

function cleanEmailMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.length <= 3000 ? cleaned : null;
}

// One customer, one message - direct, low-risk (they already have a real
// relationship with this business, not a cold broadcast), so this is
// deliberately NOT a "email everyone who booked this month" tool. That's
// real added scope of its own (unsubscribe links, consent tracking,
// spam safeguards) and a deliberate decision to leave for later, not an
// oversight here.
export async function proposeEmailCustomer(businessId: string, args: { customerName: unknown; subject: unknown; message: unknown }) {
  const name = cleanName(args.customerName);
  const subject = cleanEmailSubject(args.subject);
  const message = cleanEmailMessage(args.message);
  if (!name) return { error: 'Which customer? Give a real name to search for.' };
  if (!subject) return { error: 'Give a real subject line (1-150 characters).' };
  if (!message) return { error: 'Give a real message (1-3000 characters).' };

  const matches = await findCustomerByName(businessId, name);
  if (matches.length === 0) return { error: `No customer found matching "${name}".` };
  if (matches.length > 1) {
    return {
      needs_disambiguation: true,
      matches: matches.map((m) => ({ name: m.name, email: m.email ?? 'no email on file' })),
    };
  }
  const customer = matches[0];
  if (!customer.email) return { error: `${customer.name} has no email on file - try WhatsApp or a phone call instead.` };

  return { proposed: { customer_name: customer.name, customer_email: customer.email, subject, message } };
}

export async function applyEmailCustomer(businessId: string, args: { customerName: unknown; subject: unknown; message: unknown }) {
  const name = cleanName(args.customerName);
  const subject = cleanEmailSubject(args.subject);
  const message = cleanEmailMessage(args.message);
  if (!name || !subject || !message) {
    return { error: 'One of those values changed or was invalid since it was proposed - propose it again before applying.' };
  }

  // Re-resolved rather than trusting the propose step's result - the same
  // reasoning every other apply_* here already follows (a value could have
  // changed in the gap between propose and the user's actual confirmation).
  const matches = await findCustomerByName(businessId, name);
  if (matches.length !== 1 || !matches[0].email) {
    return { error: 'That customer could not be re-confirmed - propose this again.' };
  }
  const customer = matches[0] as { name: string; email: string };

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('name, accent_color, logo_url')
    .eq('id', businessId)
    .maybeSingle();

  const sent = await sendEmail(
    {
      to: customer.email,
      subject,
      html: renderEmail({
        businessName: business?.name ?? 'Your business',
        accentColor: business?.accent_color,
        logoUrl: business?.logo_url,
        preheader: message.slice(0, 140),
        heading: subject,
        intro: message,
      }),
    },
    'manageTools:applyEmailCustomer',
    { businessId }
  );

  if (!sent) return { error: "That didn't send - please try again." };
  return { applied: true, customer_name: customer.name, customer_email: customer.email, subject };
}
