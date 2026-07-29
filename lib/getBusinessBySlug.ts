import { supabasePublic } from './supabase';
import { summarizeHours } from './formatHours';

// This one function is what makes "one file handles every business" work.
// Every business page calls this to load only its own data.
export async function getBusinessBySlug(slug: string) {
  const { data: business, error } = await supabasePublic
    .from('businesses')
    .select(
      'id, slug, name, business_type, description, about_text, gallery_urls, contact_phone, contact_email, instagram_url, facebook_url, show_about, show_gallery, show_contact, logo_url, cover_image_url, accent_color, timezone'
    )
    .eq('slug', slug)
    .single();

  if (error || !business) return null;

  const [{ data: services }, { count: productCount }, { data: hours }] = await Promise.all([
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
    supabasePublic
      .from('availability')
      .select('day_of_week, start_time, end_time')
      .eq('business_id', business.id)
      .is('staff_id', null),
  ]);

  return {
    business,
    services: services ?? [],
    hasProducts: (productCount ?? 0) > 0,
    hoursSummary: summarizeHours(hours ?? []),
  };
}
