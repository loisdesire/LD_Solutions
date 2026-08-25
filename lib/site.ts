// Single source of truth for the deployed site's absolute URL, used by
// metadata, robots.txt, and the sitemap. Set NEXT_PUBLIC_SITE_URL in your
// hosting provider's env vars once you're on a real/custom domain - this
// fallback just keeps things working without it configured yet.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vanovahub.com';

// The tenant the marketing site links to as "see it live" - shared here
// (rather than staying a local const only the homepage knew about) so the
// public business page itself can also show a "this is a demo" badge.
// Without that, a visitor who clicks through lands on what looks like a
// completely ordinary, oddly-named real business with no indication it
// isn't one.
export const DEMO_SLUG = 'glow-salon';
