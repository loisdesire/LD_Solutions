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
      <div className="min-h-screen bg-paper md:flex">
        <AdminSidebar
          slug={slug}
          businessName={business.name}
          businessType={business.business_type}
          userEmail={user.email ?? ''}
          role={staff.role ?? 'staff'}
        />
        <div className="flex-1 min-w-0">
          <AdminMobileNav slug={slug} businessName={business.name} />
          <main className="max-w-[1000px] px-6 sm:px-10 py-9">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
