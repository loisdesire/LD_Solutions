import { requireStaffSession } from '@/lib/requireStaffSession';
import AdminNav from '@/components/AdminNav';
import ServicesManager from '@/components/ServicesManager';

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price, active')
    .eq('business_id', business.id)
    .order('name');

  return (
    <main className="min-h-screen bg-canvas bg-grid">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 animate-rise">
        <AdminNav slug={slug} />

        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Services
          </h1>
          <p className="text-muted mt-3">
            What customers can book, and how long each one takes.
          </p>
        </header>

        <ServicesManager businessId={business.id} initialServices={services ?? []} />
      </div>
    </main>
  );
}
