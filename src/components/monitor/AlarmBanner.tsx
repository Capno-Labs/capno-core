'use client';

import type { AlarmState } from '@/lib/engine/types';

interface AlarmBannerProps {
  alarms: AlarmState[];
  silenced: boolean;
}

export function AlarmBanner({ alarms, silenced }: AlarmBannerProps) {
  if (alarms.length === 0) {
    return (
      <div className="flex h-9 items-center rounded-md bg-monitor-panel px-3 text-xs font-mono text-slate-500 ring-1 ring-monitor-grid">
        No active alarms
      </div>
    );
  }

  const critical = alarms.filter((a) => a.level === 'critical');
  const shown = critical.length > 0 ? critical : alarms;
  const isCritical = critical.length > 0;

  return (
    <div
      role="alert"
      className={`flex h-9 items-center gap-4 overflow-x-auto rounded-md px-3 text-sm font-mono font-bold uppercase tracking-wide ${
        isCritical
          ? `bg-red-950 text-red-300 ring-2 ring-red-500 ${silenced ? '' : 'animate-alarm-flash'}`
          : 'bg-yellow-950 text-yellow-300 ring-2 ring-yellow-500/70'
      }`}
    >
      {silenced && <span className="text-xs normal-case opacity-70">🔕 silenced</span>}
      {shown.map((a, i) => (
        <span key={`${a.vital}-${i}`} className="whitespace-nowrap">
          {a.message}
        </span>
      ))}
    </div>
  );
}
