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

  return (
    <div>
      {/* Title, live active/hidden counts, and "Add product" now all
          render inside ProductsManager itself, sharing one row - moved
          from here so the button (whose state already lives in that
          component) could sit on the same line as the heading instead of
          its own row below it. Same fix as the Services page. */}
      <ProductsManager businessId={business.id} initialProducts={products ?? []} />
    </div>
  );
}
