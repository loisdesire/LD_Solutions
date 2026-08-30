'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import { labelClass } from './formStyles';

// `htmlFor` appeared ZERO times across the whole codebase - roughly 40
// form controls had a visually adjacent <label> that was not actually
// associated with its input. Clicking the label didn't focus the field,
// and a screen reader announced the control unnamed.
//
// useId rather than a hand-passed id so two instances of the same form
// (e.g. an inline edit row per service) can't collide.
export default function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && !error && (
        <p id={hintId} className="text-ink-faint text-[13px] mt-1.5">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-error text-[13px] mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
