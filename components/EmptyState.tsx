import Link from 'next/link';
import type { ReactNode } from 'react';

// Codifies the pattern already proven in AdminDashboardBody's bookings
// empty state - what's missing, why it matters, and what to do next -
// against the dozen or so elsewhere that just said "No services yet".
//
// The brief's rule: never a bare "no data". A blank screen is where a new
// business decides whether this product works, so it's the screen that
// most needs to tell them what to do.
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string } | { label: string; onClick: () => void };
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? 'py-8' : 'py-14'} px-6`}>
      {icon && (
        <div
          className="h-11 w-11 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'var(--accent-soft)' }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className="font-display text-[17px] text-ink mb-1.5">{title}</p>
      <p className="text-ink-soft text-body-sm max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && (
        <div className="mt-5">
          {'href' in action ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 min-h-[44px] text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 min-h-[44px] text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
