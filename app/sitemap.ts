import type { MetadataRoute } from 'next';
import { supabasePublic } from '@/lib/supabase';
import { SITE_URL } from '@/lib/site';
import { logError } from '@/lib/logger';

// Cached full-route by default like everything else with no dynamic API
// use (see the ISR-style Cache-Control this route serves at) - but the
// query below used to discard `error` entirely (`const { data } = ...`),
// same silent-swallow shape as the Calendar/Dashboard/Customers bug from
// earlier tonight. The live sitemap was confirmed showing only the 2
// static URLs, zero business pages, despite the logic below clearly
// being built to include every one plus their about/gallery/contact
// pages - reading and logging the real error now instead of quietly
// falling back to an empty list is the same fix, applied here too.
//
// That logging is what caught the ACTUAL root cause, live: this used to
// also select `updated_at`, a column businesses has never had (verified
// against supabase/schema.sql - only created_at exists, and nothing
// anywhere sets an updated_at on this table). Every single request was
// failing with a real Postgres "column does not exist" error, which the
// error-swallowing bug above was hiding - the sitemap had been serving
// just the 2 static URLs in production this whole time. created_at is
// real and always populated, so lastModified uses that alone now, rather
// than adding a genuinely-tracked updated_at column, which would mean
// touching every write path across the app (settings, services, hours,
// channels, profile...) just to keep one sitemap hint fresh.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: businesses, error } = await supabasePublic
    .from('businesses')
    .select('slug, created_at, show_about, show_gallery, show_contact');
  if (error) logError('sitemap:businesses-query', error);

  const businessUrls: MetadataRoute.Sitemap = (businesses ?? []).map((b) => ({
    url: `${SITE_URL}/${b.slug}`,
    lastModified: b.created_at ? new Date(b.created_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const contentUrls: MetadataRoute.Sitemap = (businesses ?? []).flatMap((b) =>
    [
      b.show_about ? 'about' : null,
      b.show_gallery ? 'gallery' : null,
      b.show_contact ? 'contact' : null,
    ]
      .filter((page): page is string => Boolean(page))
      .map((page) => ({
        url: `${SITE_URL}/${b.slug}/${page}`,
        lastModified: b.created_at ? new Date(b.created_at) : undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }))
  );

  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/signup`, changeFrequency: 'monthly', priority: 0.5 },
    ...businessUrls,
    ...contentUrls,
  ];
}
