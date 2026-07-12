import { requireStaffSession } from '@/lib/requireStaffSession';
import AdminNav from '@/components/AdminNav';
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
    <main className="min-h-screen bg-canvas bg-grid">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 animate-rise">
        <AdminNav slug={slug} />

        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Staff
          </h1>
          <p className="text-muted mt-3">
            Invite teammates to help manage bookings for {business.name}.
          </p>
        </header>

        <StaffManager
          businessId={business.id}
          businessName={business.name}
          slug={slug}
          currentUserId={user.id}
          initialStaff={staff ?? []}
          initialInvites={invites ?? []}
        />
      </div>
    </main>
  );
}
