import type { MetadataRoute } from 'next';
import { supabasePublic } from '@/lib/supabase';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: businesses } = await supabasePublic
    .from('businesses')
    .select('slug, created_at');

  const businessUrls: MetadataRoute.Sitemap = (businesses ?? []).map((b) => ({
    url: `${SITE_URL}/${b.slug}`,
    lastModified: b.created_at ? new Date(b.created_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/signup`, changeFrequency: 'monthly', priority: 0.5 },
    ...businessUrls,
  ];
}
