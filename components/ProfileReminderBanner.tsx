import Link from 'next/link';

// SetupChecklist below already covers "profile isn't done at all" - but its
// profileDone signal is deliberately an either/or (logo OR description; see
// lib/onboardingProgress.ts's own comment on why that stays lenient), so a
// business that added a description and skipped the logo during onboarding
// reads as "done" there and never sees anything about it again. That's
// exactly the gap the onboarding chat's final checklist sweep promises to
// close when an owner says "just remind me later" instead of adding an
// essential item right then - this is that reminder. Deliberately its own
// small strip rather than reopening SetupChecklist's profile row: it only
// ever names the SPECIFIC thing still missing (Logo and/or description),
// and only appears once that bigger checklist has already stopped treating
// profile as incomplete.
export default function ProfileReminderBanner({
  slug,
  profileDone,
  hasLogo,
  hasDescription,
}: {
  slug: string;
  profileDone: boolean;
  hasLogo: boolean;
  hasDescription: boolean;
}) {
  if (!profileDone) return null;

  const missing = [!hasLogo && 'Logo', !hasDescription && 'Business description'].filter(Boolean) as string[];
  if (missing.length === 0) return null;

  const blurb = !hasLogo
    ? 'A logo makes a big difference in how customers recognize your page.'
    : 'A short description helps customers know what to expect before they book.';

  return (
    <div className="rounded-2xl bg-warm-surface border border-line mb-8 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="font-semibold text-[14px] text-ink">
          {missing.length} thing{missing.length > 1 ? 's' : ''} left to finish your profile - {missing.join(', ')}
        </p>
        <p className="text-caption text-ink-soft mt-0.5">{blurb}</p>
      </div>
      <Link
        href={`/${slug}/admin/settings?section=profile`}
        className="shrink-0 rounded-full border border-line-strong px-3.5 py-2 min-h-[36px] flex items-center text-caption font-medium text-ink hover:border-accent hover:text-accent transition-colors"
      >
        Add now
      </Link>
    </div>
  );
}
