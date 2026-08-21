import { redirect } from 'next/navigation';

// Insights and Schedule assistant merged into one Assistant tab. Kept as a
// redirect rather than deleted: the split was visible in the URL, so
// bookmarks and any older links should still land somewhere useful.
export default async function InsightsRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/admin/assistant`);
}
