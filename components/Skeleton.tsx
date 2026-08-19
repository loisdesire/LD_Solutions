// Extracted from BookingForm.tsx's time-slot loading state, where this exact
// shimmer-gradient block was written out twice inline (once for the label,
// once per slot pill, differing only in size and animationDelay). Same
// visual (uses the existing `animate-shimmer` keyframe from
// tailwind.config.js), just a named, reusable shape instead of two
// hand-duplicated `style={{ backgroundImage: ... }}` blocks.
export default function Skeleton({
  className = '',
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`bg-warm-surface animate-shimmer ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, transparent, var(--line), transparent)',
        backgroundSize: '200% 100%',
        animationDelay: delay ? `${delay}s` : undefined,
      }}
    />
  );
}
