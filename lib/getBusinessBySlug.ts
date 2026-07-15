import { supabasePublic } from './supabase';

// This one function is what makes "one file handles every business" work.
// Every business page calls this to load only its own data.
export async function getBusinessBySlug(slug: string) {
  const { data: business, error } = await supabasePublic
    .from('businesses')
    .select('id, slug, name, business_type, logo_url, accent_color, timezone')
    .eq('slug', slug)
    .single();

  if (error || !business) return null;

  const [{ data: services }, { count: productCount }] = await Promise.all([
    supabasePublic
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('business_id', business.id)
      .eq('active', true)
      .order('name'),
    supabasePublic
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('active', true),
  ]);

  return { business, services: services ?? [], hasProducts: (productCount ?? 0) > 0 };
}
