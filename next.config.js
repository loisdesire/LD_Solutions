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
