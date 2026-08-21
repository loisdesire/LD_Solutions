import type { ReactNode } from 'react';

// Every admin page repeats the same eyebrow / title / description block,
// and the ones with a primary action were putting it on its own full-width
// row underneath, which wastes a line on a page whose content starts right
// after it.
//
// The action sits beside the title here, which is where the eye already is
// when you land on the page.
export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-1.5">{eyebrow}</div>
        <h1 className="font-display text-h1 text-ink">{title}</h1>
        {description && <p className="text-ink-soft text-body-sm mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
