'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

/**
 * Label + control + hint + error, wired for assistive tech: a real <label>,
 * `aria-describedby` for the hint/error, `aria-invalid` when there is an
 * error. Pass exactly one control (input/select/textarea) as the child; the
 * field injects its id and ARIA attributes.
 *
 *   <Field label="Email" error={emailError}>
 *     <input className="input" type="email" … />
 *   </Field>
 */
export function Field({
  label,
  hint,
  error,
  className = '',
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }>;
}) {
  const auto = useId();
  const id = (isValidElement(children) && children.props.id) || auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-faint">
          {hint}
        </p>
      )}
    </div>
  );
}
