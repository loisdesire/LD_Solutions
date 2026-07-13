import type { CSSProperties, ReactNode } from 'react';
import { getContrastColor, hexToRgba } from '@/lib/color';

// Scopes --accent/--accent-contrast/--accent-soft to a business's own
// accent_color for everything inside it. Used on customer-facing pages
// only — admin/platform screens keep the platform's own default accent.
export function AccentScope({
  color,
  children,
  className = '',
}: {
  color: string;
  children: ReactNode;
  className?: string;
}) {
  const style = {
    '--accent': color,
    '--accent-contrast': getContrastColor(color),
    '--accent-soft': hexToRgba(color, 0.1),
  } as CSSProperties;
  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}
