import { notFound } from 'next/navigation';

// Nothing in the product links here - no nav, no middleware rewrite, no
// marketing copy. It was a scaffold for a feature that was never built,
// left rendering "design pending" to anyone who found the URL directly.
// A 404 is the honest state for a route with no real page behind it yet;
// dressing it up as a "coming soon" screen would promise something that
// isn't actually planned. Revisit this file when the shop product is
// scoped for real.
export default function ShopHome() {
  notFound();
}
