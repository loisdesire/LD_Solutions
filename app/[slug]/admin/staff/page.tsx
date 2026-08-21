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
