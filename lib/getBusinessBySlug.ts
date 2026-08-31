import { supabasePublic } from './supabase';
import { summarizeHours, isOpenNow } from './formatHours';

const BASE_COLUMNS =
  'id, slug, name, business_type, description, about_text, gallery_urls, contact_phone, contact_email, instagram_url, facebook_url, show_about, show_gallery, show_contact, logo_url, cover_image_url, accent_color, timezone';

// This one function is what makes "one file handles every business" work.
// Every business page calls this to load only its own data.
export async function getBusinessBySlug(slug: string) {
  // paystack_public_key is a *public* key by design (Paystack's own docs
  // have it embedded straight in client-side checkout code) -
  // paystack_secret_key never appears in this public-facing loader, only
  // in the service-role-scoped route that actually verifies a payment.
  let { data: business, error } = await supabasePublic
    .from('businesses')
    .select(`${BASE_COLUMNS}, paystack_public_key`)
    .eq('slug', slug)
    .single();

  // 42703 = Postgres "column does not exist" - the payments migration
  // hasn't been run against this database yet. Falls back to the same
  // query without it rather than taking every public booking page down
  // in the meantime; payment collection just stays off until it's run.
  if (error?.code === '42703') {
    const fallback = await supabasePublic.from('businesses').select(BASE_COLUMNS).eq('slug', slug).single();
    business = fallback.data ? { ...fallback.data, paystack_public_key: null } : null;
    error = fallback.error;
  }

  if (error || !business) return null;

  const [servicesResult, { count: productCount }, { data: hours }] = await Promise.all([
    supabasePublic
      .from('services')
      .select('id, name, duration_minutes, price, description, image_url')
      .eq('business_id', business.id)
      .eq('active', true)
      .order('name'),
    supabasePublic
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('active', true),
    supabasePublic
      .from('availability')
      .select('day_of_week, start_time, end_time')
      .eq('business_id', business.id)
      .is('staff_id', null),
  ]);

  // Same 42703 fallback as above - this is the public booking page, so a
  // missing description/image_url migration must never take the whole
  // service list (and with it, the ability to book at all) down.
  let services = servicesResult.data;
  if (servicesResult.error?.code === '42703') {
    const fallback = await supabasePublic
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('business_id', business.id)
      .eq('active', true)
      .order('name');
    services = (fallback.data ?? []).map((s) => ({ ...s, description: null, image_url: null }));
  }

  return {
    business,
    services: services ?? [],
    hasProducts: (productCount ?? 0) > 0,
    hoursSummary: summarizeHours(hours ?? []),
    isOpenNow: isOpenNow(hours ?? [], business.timezone || 'UTC'),
  };
}
