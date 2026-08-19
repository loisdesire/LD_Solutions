import Link from 'next/link';
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';

// Consolidates what was 4+ byte-identical (or near-identical, differing only
// in size) pill-button className strings copy-pasted across app/page.tsx —
// same classes as before, just named once. Purely a dedup, not a new visual
// design: every variant/size combination here matches an exact className
// that already existed in the marketing page before this component existed.
const VARIANTS = {
  primary: 'text-white bg-accent shadow-sm hover:opacity-90 active:scale-95',
  outline: 'text-ink border-2 border-line-strong hover:border-accent hover:text-accent',
} as const;

const SIZES = {
  sm: 'px-5 py-2.5 text-[13.5px]',
  md: 'px-6 py-3 text-[14px]',
} as const;

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

// href present → internal Next.js Link. `external` → plain <a> (used for
// the live-demo link, which is same-origin but deliberately a full
// navigation rather than client-side routing in the original markup).
// Neither → a real <button>, for in-page actions (forms, modals).
type ButtonProps =
  | (CommonProps & { href: string; external?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href' | 'children'>)
  | (CommonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>);

export default function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className = '', children } = props;
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();

  if ('href' in props && props.href) {
    const { href, external, ...rest } = props as CommonProps & { href: string; external?: boolean };
    if (external) {
      return (
        <a href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    );
  }

  const { ...rest } = props as CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
