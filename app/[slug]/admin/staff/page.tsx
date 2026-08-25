import { requireStaffSession } from '@/lib/requireStaffSession';
import StaffManager from '@/components/StaffManager';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Who has access to this business at all is an owner-level decision -
  // invites/removals now go through owner-only RLS policies too, so this
  // just keeps a non-owner from landing on a page whose actions would
  // all fail once tried.
  const { business, supabase, user } = await requireStaffSession(slug, { requireOwner: true });

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, email, role, auth_id')
    .eq('business_id', business.id)
    .order('created_at');

  const { data: invites } = await supabase
    .from('staff_invites')
    .select('id, email, token')
    .eq('business_id', business.id)
    .eq('accepted', false);

  // Appointment ownership - "who does this person actually have coming
  // up" was invisible from this page entirely before. Bounded to
  // upcoming, non-cancelled bookings only (the same "what's actually
  // still relevant" filter used everywhere else in the admin, not a
  // lifetime count).
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('staff_id')
    .eq('business_id', business.id)
    .neq('status', 'cancelled')
    .gte('start_time', new Date().toISOString())
    .not('staff_id', 'is', null);

  const upcomingCountByStaffId: Record<string, number> = {};
  for (const b of upcomingBookings ?? []) {
    if (!b.staff_id) continue;
    upcomingCountByStaffId[b.staff_id] = (upcomingCountByStaffId[b.staff_id] ?? 0) + 1;
  }

  return (
    <div>
      <StaffManager
        businessId={business.id}
        businessName={business.name}
        slug={slug}
        currentUserId={user.id}
        initialStaff={staff ?? []}
        initialInvites={invites ?? []}
        upcomingCountByStaffId={upcomingCountByStaffId}
      />
    </div>
  );
}
