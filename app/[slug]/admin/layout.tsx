import { requireStaffSession } from '@/lib/requireStaffSession';
import AdminSidebar from '@/components/AdminSidebar';
import AdminMobileNav from '@/components/AdminMobileNav';
import { ToastProvider } from '@/components/Toast';
import type { Metadata } from 'next';

// Private staff area - never indexed, regardless of what any individual
// admin page under here does or doesn't set.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// One shared shell for every /[slug]/admin/* page: does the staff-session
// check once, renders the persistent sidebar (business identity, nav,
// account/sign-out), and lets each page just render its own content.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, user, staff } = await requireStaffSession(slug);

  return (
    <ToastProvider>
      <div className="admin-root min-h-screen bg-warm-surface md:flex">
        <AdminSidebar
          slug={slug}
          businessName={business.name}
          businessType={business.business_type}
          userEmail={user.email ?? ''}
          role={staff.role ?? 'staff'}
        />
        <div className="flex-1 min-w-0 bg-paper md:bg-warm-surface">
          <AdminMobileNav slug={slug} businessName={business.name} />
          <main className="max-w-[1180px] px-5 sm:px-8 lg:px-12 py-7 sm:py-10">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
