import Link from 'next/link';
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';

// Rectangular (rounded-xl), not the fully-pill treatment every button in
// the previous system used regardless of context - a pill reads as a
// single decorative choice; distinguishing shape by weight (solid vs.
// bordered vs. soft-tinted) is what actually communicates hierarchy.
// `primary` lifts on hover (shadow + a slight rise) rather than just
// dimming opacity, which is what makes an interaction feel considered
// rather than just "less visible."
const VARIANTS = {
  primary: 'text-accent-contrast bg-accent shadow-lift hover:bg-accent-hover hover:shadow-soft hover:-translate-y-px active:translate-y-0 active:bg-accent-active',
  outline: 'text-ink border-[1.5px] border-line-strong bg-surface hover:border-accent hover:text-accent',
  // Soft-tinted, no border - a middle-weight action that isn't the page's
  // primary CTA but shouldn't read as a plain link either.
  secondary: 'text-accent bg-accent-soft hover:bg-accent/[0.16]',
} as const;

const SIZES = {
  sm: 'px-4 py-2.5 text-[13.5px]',
  md: 'px-5 py-3 text-[14px]',
  lg: 'px-7 py-3.5 text-[15px]',
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
  // variant/size/className/children MUST be pulled out in the same
  // destructure that builds `rest`. Reading them into consts separately
  // (an earlier version of this file) leaves them in `rest`, and then
  // {...rest} spread onto the element both overrode the computed
  // className - silently rendering every Button that passed a className
  // as unstyled plain text - and leaked `variant` onto the DOM as an
  // invalid HTML attribute.
  const { variant = 'primary', size = 'md', className = '', children, ...rest } = props;

  const classes =
    `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();

  if ('href' in rest && rest.href) {
    const { href, external, ...anchorProps } = rest as {
      href: string;
      external?: boolean;
    } & AnchorHTMLAttributes<HTMLAnchorElement>;

    // className is passed after the spread as a second guard, so a stray
    // className surviving in the rest props can never clobber it again.
    if (external) {
      return (
        <a {...anchorProps} href={href} className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link {...anchorProps} href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} className={classes}>
      {children}
    </button>
  );
}
