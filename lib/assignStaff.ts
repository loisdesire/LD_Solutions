import { createClient } from '@supabase/supabase-js';

// Server-side only, same reasoning as every other file here that reads
// `bookings`/`staff` with elevated access: this runs from booking-creation
// routes across every channel (web form, WhatsApp/Telegram/web-chat via
// lib/whatsappTools.ts), never in the browser.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// bookings.staff_id existed as a column but was never actually set by any
// live booking-creation path - which meant the no_overlapping_bookings
// exclusion constraint (business_id, time_range) blocked ANY two
// overlapping bookings business-wide, regardless of staff. A business
// with three staff could only ever have one appointment at a time across
// its whole team. The constraint is now staff-scoped instead (see
// supabase/schema.sql's staff_id-aware version) - which only works once
// every booking is actually assigned to a real staff member, hence this.
//
// Auto-assigns rather than adding a "pick your stylist" step to the
// booking flow - there's no per-staff specialty/service mapping in the
// schema yet for a customer to meaningfully choose from, and the whole
// product pitch is "no back-and-forth, no extra steps". Picks whichever
// staff member has no conflicting booking in the window; "first free one
// found", not load-balanced or preference-ordered - nothing about who
// gets picked is customer-visible today. Every business has at least one
// staff row (the owner is staff too), so this only returns null if every
// single staff member is genuinely busy at that exact time - which the
// availability check upstream should already have prevented from being
// offered as a bookable slot in the first place.
export async function pickAvailableStaffId(
  businessId: string,
  startTimeISO: string,
  endTimeISO: string,
  bufferMinutes = 0,
  excludeBookingId?: string
): Promise<string | null> {
  const { data: staffRows } = await supabaseAdmin.from('staff').select('id').eq('business_id', businessId);
  if (!staffRows || staffRows.length === 0) return null;

  const bufferedStart = new Date(new Date(startTimeISO).getTime() - bufferMinutes * 60000).toISOString();
  const bufferedEnd = new Date(new Date(endTimeISO).getTime() + bufferMinutes * 60000).toISOString();

  // Standard range-overlap test (existing.start < window.end AND
  // existing.end > window.start), widened by the buffer - mathematically
  // the same comparison lib/slotGenerator.ts makes, just done in SQL
  // against real rows here instead of in memory against a candidate slot.
  let query = supabaseAdmin
    .from('bookings')
    .select('staff_id')
    .eq('business_id', businessId)
    .neq('status', 'cancelled')
    .not('staff_id', 'is', null)
    .lt('start_time', bufferedEnd)
    .gt('end_time', bufferedStart);

  if (excludeBookingId) query = query.neq('id', excludeBookingId);
  const { data: overlapping } = await query;

  const busyStaffIds = new Set((overlapping ?? []).map((b) => b.staff_id as string));
  const free = staffRows.find((s) => !busyStaffIds.has(s.id));
  return free?.id ?? null;
}
