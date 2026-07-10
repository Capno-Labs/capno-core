'use client';

import { useState, type KeyboardEvent } from 'react';

const LENGTH = 4;

/**
 * Segmented session-code entry: one real input (single mobile keyboard,
 * screen-reader label, paste support) rendered invisibly over four visual
 * character boxes, OTP-style. Each typed character pops in; the boxes light
 * up green once the code is complete.
 */
export function CodeInput({
  value,
  onChange,
  onSubmit,
  autoFocus = false,
}: {
  value: string;
  onChange: (code: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const chars = value.slice(0, LENGTH).split('');
  const full = chars.length === LENGTH;
  const activeIndex = Math.min(chars.length, LENGTH - 1);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && full) onSubmit?.();
  };

  return (
    <div className="relative">
      <input
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, LENGTH))}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={LENGTH}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Session code"
      />
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: LENGTH }, (_, i) => {
          const char = chars[i] ?? '';
          const active = focused && !full && i === activeIndex && !char;
          return (
            <div
              key={i}
              className={`flex h-16 w-12 items-center justify-center rounded-lg bg-slate-800 font-mono text-3xl text-slate-100 transition-shadow duration-150 ${
                char && full
                  ? 'ring-2 ring-vital-ecg/60'
                  : active
                    ? 'ring-2 ring-sky-500'
                    : 'ring-1 ring-slate-700'
              }`}
            >
              {char ? (
                <span key={`${i}:${char}`} className="motion-safe:animate-char-pop">
                  {char}
                </span>
              ) : (
                active && <span className="h-8 w-0.5 animate-pulse rounded bg-sky-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
