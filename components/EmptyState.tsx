import type { ReactNode } from 'react';

// Codifies the pattern AdminDashboardBody and ServicesManager and
// CustomersManager already used independently, each with its own copy of
// the same markup: an icon, what's missing, why it matters, and an action
// if there's somewhere useful to send someone. Several managers (Staff,
// Billing) fell back to a single plain sentence instead - not literally
// no empty state, just a visibly weaker one than everywhere else in the
// product, which reads as inconsistency more than a design choice.
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** A tighter version for a section nested inside another card, rather than a full-page empty state. */
  compact?: boolean;
}) {
  // Solid border + a filled surface, not a dashed outline - dashed reads
  // as "wireframe/placeholder" rather than a considered state, and it
  // was the default treatment for nearly every empty state in the app.
  return (
    <div className={`border border-line rounded-2xl bg-warm-surface text-center ${compact ? 'p-8' : 'p-10 sm:p-14'}`}>
      <div className="mx-auto mb-5 h-12 w-12 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
        {icon}
      </div>
      <h2 className="font-display text-[19px] font-semibold">{title}</h2>
      <p className="text-ink-soft text-body-sm mt-1.5 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
