import { redirect } from 'next/navigation';

// PRODUCT_FEATURES.md has documented this as "a dedicated booking route...
// intended for direct booking links" since before this route actually
// existed - a real mismatch between the spec and the app, not just
// missing polish. The booking form itself lives on the main business
// page at the #book anchor (app/[slug]/page.tsx), so rather than
// duplicate that whole flow behind a second URL, this is what "a direct
// link straight to booking" actually needs: skip the marketing hero,
// land right on the form.
export default async function BookRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}#book`);
}
