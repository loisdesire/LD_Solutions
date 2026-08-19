import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The one place that answers "what timezone is this business in" — was a
// near-identical inline query repeated across whatsappTools.ts (5x),
// insightsTools.ts, rescheduleTools.ts, getAvailableSlots.ts, and the
// booking-reschedule API route. Defaults to UTC on a missing/unknown
// business rather than throwing, matching what every one of those call
// sites already did on its own.
export async function getBusinessTimezone(businessId: string): Promise<string> {
  const { data } = await supabaseAdmin.from('businesses').select('timezone').eq('id', businessId).single();
  return data?.timezone || 'UTC';
}
