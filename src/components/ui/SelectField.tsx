'use client';

import type { ReactNode } from 'react';
import { Field } from './Field';

export interface SelectOption<T extends string> {
  value: T;
  /** What people read — never the stored enum text. */
  label: string;
}

/**
 * A labelled <select> with human-readable option labels. `emptyLabel` adds a
 * first "not set" choice, reported to `onChange` as undefined.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  hint,
  error,
  className = '',
}: {
  label: ReactNode;
  value: T | undefined;
  options: readonly SelectOption<T>[];
  onChange: (value: T | undefined) => void;
  emptyLabel?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}) {
  return (
    <Field className={className} label={label} hint={hint} error={error}>
      <select
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : (e.target.value as T))}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Options from a `Record<enum, label>` map, in the map's order. */
export function optionsFrom<T extends string>(labels: Record<T, string>): SelectOption<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
