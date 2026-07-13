import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*/admin',
        '/*/admin/*',
        '/*/login',
        '/*/forgot-password',
        '/*/reset-password',
        '/*/accept-invite',
        '/*/manage/*',
        '/api/*',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
