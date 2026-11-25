'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { formatTime, parseTime } from '@/lib/formFields';
import { Field } from './Field';

/**
 * A duration or clock time typed as minutes:seconds ("1:30"); a bare number
 * is seconds. The stored value is always seconds — the one unit the case
 * format uses — so authors never convert in their heads.
 */
export function TimeField({
  label,
  valueSec,
  onChange,
  required = false,
  minSec,
  maxSec,
  placeholder = 'm:ss',
  hint,
  className = '',
}: {
  label: ReactNode;
  valueSec: number | undefined;
  /** Seconds, or undefined when emptied (never when `required`). */
  onChange: (valueSec: number | undefined) => void;
  required?: boolean;
  minSec?: number;
  maxSec?: number;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
}) {
  const [text, setText] = useState(valueSec === undefined ? '' : formatTime(valueSec));
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setText((current) => {
      if (valueSec === undefined) return parseTime(current) === null ? current : '';
      return parseTime(current) === valueSec ? current : formatTime(valueSec);
    });
    setProblem(null);
  }, [valueSec]);

  const commit = (next: string) => {
    setText(next);
    if (next.trim() === '') {
      if (required) setProblem('Enter a time, like 1:30.');
      else {
        setProblem(null);
        onChange(undefined);
      }
      return;
    }
    const sec = parseTime(next);
    if (sec === null) {
      setProblem('Enter minutes:seconds, like 1:30.');
      return;
    }
    if (minSec !== undefined && sec < minSec) {
      setProblem(`Use ${formatTime(minSec)} or more.`);
      return;
    }
    if (maxSec !== undefined && sec > maxSec) {
      setProblem(`Use ${formatTime(maxSec)} or less.`);
      return;
    }
    setProblem(null);
    if (sec !== valueSec) onChange(sec);
  };

  return (
    <Field
      className={className}
      label={
        <>
          {label}
          <span className="ml-1 font-normal normal-case tracking-normal text-faint">min:sec</span>
        </>
      }
      hint={hint}
      error={problem}
    >
      <input
        className="input tabular-nums"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => {
          // Tidy "90" to "1:30"; a field left with a problem returns to its value.
          setText(valueSec === undefined ? '' : formatTime(valueSec));
          setProblem(null);
        }}
      />
    </Field>
  );
}
