import { requireStaffSession } from '@/lib/requireStaffSession';
import ProductsManager from '@/components/ProductsManager';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { business, supabase } = await requireStaffSession(slug);

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, price, stock_quantity, active')
    .eq('business_id', business.id)
    .order('name');

  const activeCount = (products ?? []).filter((p) => p.active).length;
  const hiddenCount = (products ?? []).length - activeCount;

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-1.5">
          Manage · Products
        </div>
        <h1 className="font-display text-[26px] text-ink">Products</h1>
        {(products ?? []).length > 0 && (
          <p className="font-mono text-[11px] text-ink-faint mt-1.5">
            {activeCount} active{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
          </p>
        )}
      </div>

      <ProductsManager businessId={business.id} initialProducts={products ?? []} />
    </div>
  );
}
