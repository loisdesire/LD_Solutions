// Fail the build loudly, immediately, before any page compiles, if a
// NEXT_PUBLIC_* var the app can't run correctly without is missing -
// added after NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY went missing on a real
// deploy and silently broke the deposit flow for every customer (the
// popup just spun forever, no error anywhere) until someone happened to
// notice and check by hand. A NEXT_PUBLIC_* var is undefined when
// missing, not a thrown error - the whole class of bug this guards
// against is real code silently running with a hole in it, not crashing.
// Scoped to the vars whose absence is total breakage or a severe silent
// failure, not every optional one (push notifications, Meta integration
// still gated behind pending App Review) - those degrade a feature, not
// the app or its revenue path, and don't need to block a deploy.
const REQUIRED_PUBLIC_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY',
];
const missing = REQUIRED_PUBLIC_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'The build has been stopped rather than shipping with these silently undefined - ' +
      'set them in the hosting provider\'s environment variables panel and redeploy.'
  );
}

/** @type {import('next').NextConfig} */
// Didn't exist before this file was added - every business photo (cover
// image, logo, gallery) is a raw <img> pointed at Supabase Storage, so
// next/image was never usable: with no config at all, its default host
// allowlist is empty and it throws for any remote src. `*.supabase.co`
// (not the one project's specific subdomain) so this keeps working if the
// project is ever rotated or a staging project is added, without someone
// having to remember this file exists.
//
// images.unsplash.com is here too, found the hard way: the seeded demo
// business (glow-salon, linked from the homepage's "See it live") has
// Unsplash URLs sitting in its cover_image_url/gallery_urls columns, not
// re-uploaded Supabase photos - nothing in the codebase treats Unsplash
// as a real feature (no code references it), it's just what that one
// demo row happens to contain. Allowlisted rather than worked around,
// since a 500 on the one page prospects are told to go look at would be
// worse than a slightly wider host list.
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;
