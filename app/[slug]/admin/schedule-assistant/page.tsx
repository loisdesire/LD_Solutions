import { redirect } from 'next/navigation';

// See the note in ../insights/page.tsx - both tabs are now one Assistant.
export default async function ScheduleAssistantRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/admin/assistant`);
}
