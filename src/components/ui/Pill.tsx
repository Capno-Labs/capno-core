import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'green' | 'amber' | 'blue' | 'red';

const TONES: Record<PillTone, string> = {
  neutral: 'bg-panel-2 text-muted',
  green: 'bg-green-soft text-green',
  amber: 'bg-amber-soft text-amber-strong',
  blue: 'bg-blue-soft text-blue',
  red: 'bg-red-soft text-red',
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
