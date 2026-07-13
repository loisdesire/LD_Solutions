import { requireStaffSession } from '@/lib/requireStaffSession';
import StaffManager from '@/components/StaffManager';

export default async function StaffPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase, user } = await requireStaffSession(slug);

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

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage
        </div>
        <h1 className="font-display text-[26px] text-ink">Your team</h1>
        <p className="text-ink-soft text-[13.5px] mt-1">
          Invite people to help manage bookings for {business.name}.
        </p>
      </div>

      <StaffManager
        businessId={business.id}
        businessName={business.name}
        slug={slug}
        currentUserId={user.id}
        initialStaff={staff ?? []}
        initialInvites={invites ?? []}
      />
    </div>
  );
}
