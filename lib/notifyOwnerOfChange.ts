import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
import { renderEmail, type EmailRow } from './emailTemplate';
import { formatMoney } from './formatMoney';
import { SITE_URL } from './site';
import { logError } from './logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// "for every change, there's a confirmation AND an email" - the confirmation
// half already existed (the propose/apply pattern itself, and the model's
// own reply). This is the email half: an audit trail to the owner's inbox
// every time the assistant actually changes something, regardless of which
// channel it happened on (WhatsApp, Telegram, web chat, the dashboard's own
// Ask bar) or who was chatting (owner or staff - the assistant doesn't gate
// MANAGE_TOOLS by role, so this is also how an owner finds out a staff
// member changed something without having to ask).
//
// Scoped to MANAGE_TOOLS only, not reschedule/booking tools - those already
// notify the affected customer directly, which is a different,
// already-solved problem. If reschedule/booking changes need their own
// owner-facing trail later, that's a separate, deliberate addition.
const SETTING_LABELS: Record<string, string> = {
  about: 'the About page',
  gallery: 'the Gallery page',
  contact: 'the Contact page',
  payment: 'requiring payment to confirm a booking',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: 'business name',
  description: 'description',
  logo_url: 'logo',
  cover_image_url: 'cover photo',
  accent_color: 'accent color',
};

const SERVICE_FIELD_LABELS: Record<string, string> = {
  name: 'name',
  duration_minutes: 'duration',
  price: 'price',
  description: 'description',
  image_url: 'photo',
  active: 'visibility',
};

// Image fields are real URLs, not worth putting in the email itself (long,
// not meaningful to read, and the owner can just open the dashboard to see
// the actual photo) - shown as a plain "New photo" row instead.
const IMAGE_FIELDS = new Set(['logo_url', 'cover_image_url', 'image_url']);

function formatFieldValue(key: string, value: unknown): string {
  if (IMAGE_FIELDS.has(key)) return 'New photo';
  if (key === 'price') return value == null ? 'Ask for pricing' : formatMoney(Number(value));
  if (key === 'duration_minutes') return `${value} min`;
  if (key === 'active') return value ? 'Visible' : 'Hidden';
  if (key === 'accent_color') return String(value).toUpperCase();
  return String(value);
}

// One row per field the model actually changed, labeled and formatted for
// reading rather than a flattened "changed: price, description" sentence -
// the email's own template (lib/emailTemplate.ts) already has a proper
// `rows` table for exactly this shape, this just needed to actually use it.
function changedFieldRows(args: Record<string, unknown>, labels: Record<string, string>): EmailRow[] {
  return Object.keys(args)
    .filter((k) => k in labels && args[k] !== undefined)
    .map((k) => ({ label: labels[k], value: formatFieldValue(k, args[k]) }));
}

export type ChangeSummary = { intro: string; rows: EmailRow[] };

// Turns a successful apply_* tool call into a structured summary for the
// email below - a short intro line plus labeled rows (Service/Price/
// Duration, Setting/Status, etc.), not one flattened sentence trying to
// carry every detail at once. Returns null for a propose_* call (nothing
// changed yet), or for any apply_* whose result carries an error (the
// write itself failed, so there's nothing to report).
export function describeManageToolChange(name: string, args: Record<string, unknown>, result: unknown): ChangeSummary | null {
  if (!name.startsWith('apply_')) return null;
  const r = result as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || 'error' in r) return null;

  switch (name) {
    case 'apply_create_service':
      return {
        intro: 'A new service was created.',
        rows: [
          { label: 'Service', value: String(args.name) },
          ...(args.duration_minutes != null ? [{ label: 'Duration', value: formatFieldValue('duration_minutes', args.duration_minutes) }] : []),
          { label: 'Price', value: formatFieldValue('price', args.price) },
          ...(args.category ? [{ label: 'Category', value: String(args.category) }] : []),
        ],
      };
    case 'apply_update_service': {
      const changes = (args.changes as Record<string, unknown>) ?? {};
      return {
        intro: `"${String(args.service_name)}" was updated.`,
        rows: changedFieldRows(changes, SERVICE_FIELD_LABELS),
      };
    }
    case 'apply_toggle_setting':
      return {
        intro: 'A setting was changed.',
        rows: [
          { label: 'Setting', value: SETTING_LABELS[String(args.setting)] ?? String(args.setting) },
          { label: 'Status', value: args.enabled ? 'On' : 'Off' },
        ],
      };
    case 'apply_update_profile':
      return {
        intro: 'Your business profile was updated.',
        rows: changedFieldRows(args, PROFILE_FIELD_LABELS),
      };
    case 'apply_update_hours': {
      const day = DAY_NAMES[Number(args.day_of_week)] ?? 'A day';
      return {
        intro: 'Your hours were updated.',
        rows: [
          { label: 'Day', value: day },
          { label: 'Hours', value: args.closed ? 'Closed' : `${args.start_time}-${args.end_time}` },
        ],
      };
    }
    case 'apply_create_reminder':
      return {
        intro: 'A reminder was set.',
        rows: [
          { label: 'Reminder', value: String(args.message) },
          { label: 'When', value: String(args.remind_at) },
        ],
      };
    case 'apply_email_customer':
      // Same oversight reasoning as every other entry here - relevant
      // even more so on this one, since a staff member emailing a
      // customer directly is exactly the kind of thing an owner who
      // wasn't the one chatting would want visibility into.
      return {
        intro: 'An email was sent to a customer.',
        rows: [
          { label: 'To', value: String(args.customer_name) },
          { label: 'Subject', value: String(args.subject) },
        ],
      };
    default:
      return null;
  }
}

// The actual "look up the owner, brand it as their business, send it"
// logic - was written once inline inside notifyOwnerOfManageChange below;
// pulled out so a new-booking email fallback and a cancellation notice
// (both genuinely different events, not "a change") don't each duplicate
// the same owner-lookup-plus-renderEmail boilerplate a third and fourth
// time. Always to the OWNER specifically, not whoever caused the event -
// the point is oversight, not a receipt for someone who already knows
// (they were the one chatting, or the one who just cancelled their own
// booking).
export async function notifyOwnerByEmail(
  businessId: string,
  opts: { subject?: string; heading: string; intro: string; rows?: EmailRow[]; footerNote?: string; logContext: string }
): Promise<void> {
  const [{ data: business }, { data: owner }] = await Promise.all([
    supabaseAdmin.from('businesses').select('name, accent_color, logo_url, slug').eq('id', businessId).maybeSingle(),
    supabaseAdmin.from('staff').select('email').eq('business_id', businessId).eq('role', 'owner').maybeSingle(),
  ]);

  if (!owner?.email) return;

  try {
    await sendEmail(
      {
        to: owner.email,
        // The subject often wants the business name for inbox scanning
        // ("A change was made to Beads by Tilly"), which reads oddly
        // repeated as the in-email heading right below it - defaults to
        // the heading only when a caller doesn't need that distinction.
        subject: opts.subject ?? opts.heading,
        html: renderEmail({
          businessName: business?.name ?? 'Your business',
          accentColor: business?.accent_color,
          logoUrl: business?.logo_url,
          preheader: opts.intro,
          heading: opts.heading,
          intro: opts.intro,
          rows: opts.rows,
          cta: business?.slug ? { label: 'Open your dashboard', url: `${SITE_URL}/${business.slug}/admin` } : null,
          footerNote: opts.footerNote,
        }),
        fromName: business?.name,
      },
      opts.logContext,
      { businessId }
    );
  } catch (err) {
    // Never let a notification failure surface as if the actual event
    // (already real, already happened) failed.
    logError(opts.logContext, err, { businessId });
  }
}

export async function notifyOwnerOfManageChange(businessId: string, summary: ChangeSummary, businessName?: string | null): Promise<void> {
  await notifyOwnerByEmail(businessId, {
    subject: `A change was made to ${businessName ?? 'your business'}`,
    heading: 'Your assistant made a change',
    intro: summary.intro,
    rows: summary.rows,
    footerNote: "Wasn't you? Check who has access to your assistant and reach out to us if something looks wrong.",
    logContext: 'notifyOwnerOfManageChange',
  });
}
