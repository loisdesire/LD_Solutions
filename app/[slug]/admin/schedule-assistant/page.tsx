import { redirect } from 'next/navigation';

// This page used to be its own nav destination ("Schedule"), split out from
// /admin/assistant. Reverted - see AdminSidebar.tsx's comment - but the
// route stays alive as a redirect rather than a 404, since it may still be
// bookmarked or linked from somewhere outside the app's own nav.
export default async function ScheduleAssistantRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  redirect(`/${slug}/admin/assistant${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}
