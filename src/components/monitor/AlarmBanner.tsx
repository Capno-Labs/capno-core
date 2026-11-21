'use client';

import type { AlarmState } from '@/lib/engine/types';

interface AlarmBannerProps {
  alarms: AlarmState[];
  silenced: boolean;
}

export function AlarmBanner({ alarms, silenced }: AlarmBannerProps) {
  if (alarms.length === 0) {
    return (
      <div className="flex h-9 items-center rounded-md bg-monitor-panel px-3 text-xs font-mono text-[#8d9688] ring-1 ring-monitor-grid">
        No active alarms
      </div>
    );
  }

  const critical = alarms.filter((a) => a.level === 'critical');
  const shown = critical.length > 0 ? critical : alarms;
  const isCritical = critical.length > 0;
  // Flash only for an alarm nobody has silenced: acknowledging switches the
  // alarm lamps off, and the message stays with a tick beside it.
  const flashing = !silenced && shown.some((a) => !a.acknowledged);

  return (
    <div
      role="alert"
      className={`flex h-9 items-center gap-4 overflow-x-auto rounded-md px-3 text-sm font-mono font-bold uppercase tracking-wide ${
        isCritical
          ? `bg-red-950 text-red-300 ring-2 ring-red-500 ${flashing ? 'animate-alarm-flash' : ''}`
          : 'bg-yellow-950 text-yellow-300 ring-2 ring-yellow-500/70'
      }`}
    >
      {silenced && <span className="text-xs normal-case opacity-70">⏸ alarms paused</span>}
      {shown.map((a, i) => (
        <span
          key={`${a.vital}-${i}`}
          className={`whitespace-nowrap ${a.acknowledged ? 'opacity-70' : ''}`}
          title={a.acknowledged ? 'Silenced — still out of range' : undefined}
        >
          {a.acknowledged && <span aria-label="Silenced">✓ </span>}
          {a.message}
        </span>
      ))}
    </div>
  );
}
