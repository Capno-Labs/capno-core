'use client';

import { useId, type ReactNode } from 'react';
import type { SelectOption } from './SelectField';

/**
 * One choice from a short, fixed set (2–4 options), all visible at once — use
 * `SelectField` for longer lists. Native radio inputs underneath, so arrow
 * keys, focus and form semantics come from the platform.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  className = '',
}: {
  label: ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="label">{label}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-ctl bg-panel-2 p-1 ring-1 ring-line">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            {/* `peer`, not :has() — the selected state must show on older lab iPads. */}
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span className="block rounded-[calc(theme(borderRadius.ctl)-2px)] px-3 py-1.5 text-sm font-semibold text-muted transition duration-150 ease-brand hover:text-ink peer-checked:bg-brand peer-checked:text-on-brand peer-focus-visible:ring-2 peer-focus-visible:ring-focus">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </fieldset>
  );
}
