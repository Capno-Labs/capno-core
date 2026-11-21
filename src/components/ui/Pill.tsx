import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'green' | 'warn' | 'brand' | 'red' | 'violet';

const TONES: Record<PillTone, string> = {
  neutral: 'bg-panel-2 text-muted',
  green: 'bg-green-soft text-green',
  warn: 'bg-warn-soft text-warn-strong',
  brand: 'bg-brand-soft text-brand-strong',
  red: 'bg-red-soft text-red',
  violet: 'bg-violet-soft text-violet',
};

/** Soft status pill — the shared badge vocabulary across library and debrief. */
export function Pill({
  tone = 'neutral',
  className = '',
  children,
  title,
}: {
  tone?: PillTone;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
