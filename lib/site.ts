// Single source of truth for the deployed site's absolute URL, used by
// metadata, robots.txt, and the sitemap. Set NEXT_PUBLIC_SITE_URL in your
// hosting provider's env vars once you're on a real/custom domain - this
// fallback just keeps things working without it configured yet.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vanovahub.com';
