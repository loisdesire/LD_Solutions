// Crisp vector checkmark — renders identically on every browser/OS, unlike
// the Unicode ✓ character which different system fonts draw inconsistently
// (and can look oversized or emoji-like depending on the font).
export default function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 8.5L6.5 12L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
