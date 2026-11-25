'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { parseNumber, rangeProblem } from '@/lib/formFields';
import { Field } from './Field';

/**
 * A labelled number with its unit and range. The text someone is typing is
 * kept as typed (so "36." or an emptied box never jumps), and a value outside
 * the range is reported under the field, not silently clamped — a clamp hides
 * a typo such as 1200 for 120.
 *
 * `value` undefined means "not set". Fields that must hold a number pass
 * `required`; emptying one then shows a message and keeps the last value.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  integer = false,
  required = false,
  placeholder,
  hint,
  className = '',
  inputClassName = '',
}: {
  label: ReactNode;
  value: number | undefined;
  /** Called with a number in range, or undefined when emptied (never when `required`). */
  onChange: (value: number | undefined) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
  inputClassName?: string;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [problem, setProblem] = useState<string | null>(null);

  // Follow outside changes (undo, a preset, another field's rule) unless the
  // text already means that number — "36." must not be rewritten to "36".
  useEffect(() => {
    setText((current) => {
      const typed = parseNumber(current);
      if (value === undefined) return typed === null ? current : '';
      return typed === value ? current : String(value);
    });
    setProblem(null);
  }, [value]);

  const commit = (next: string) => {
    setText(next);
    if (next.trim() === '') {
      if (required) setProblem('Enter a number.');
      else {
        setProblem(null);
        onChange(undefined);
      }
      return;
    }
    const n = parseNumber(next);
    if (n === null) {
      setProblem('Enter a number.');
      return;
    }
    const range = rangeProblem(n, { min, max, integer, unit });
    setProblem(range);
    if (!range && n !== value) onChange(n);
  };

  return (
    <Field
      className={className}
      label={
        <>
          {label}
          {unit && <span className="ml-1 font-normal normal-case tracking-normal text-faint">{unit}</span>}
        </>
      }
      hint={hint}
      error={problem}
    >
      <input
        className={`input tabular-nums ${inputClassName}`}
        type="text"
        inputMode={integer && (min ?? 0) >= 0 ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        data-step={step}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          // Arrow keys step like a native number input.
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          const base = parseNumber(text) ?? value;
          if (base === undefined) return;
          e.preventDefault();
          const stepped = base + (e.key === 'ArrowUp' ? step : -step);
          const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, stepped));
          commit(String(Math.round(clamped * 1000) / 1000));
        }}
        onBlur={() => {
          // Leaving a field with a problem returns it to the stored value.
          if (problem) {
            setText(value === undefined ? '' : String(value));
            setProblem(null);
          }
        }}
      />
    </Field>
  );
}
