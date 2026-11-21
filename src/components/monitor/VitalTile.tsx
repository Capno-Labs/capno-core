'use client';

import { useEffect, useRef, useState } from 'react';

interface VitalTileProps {
  label: string;
  value: string;
  unit?: string;
  /** The alarm limits for this number, printed small beside the unit. */
  limits?: string;
  /** This number's limit alarms are switched off: an alarms-off mark takes
   *  the place of the limits, as on a real monitor. */
  alarmsOff?: boolean;
  /** Selecting the number opens its alarm setup. Absent = not operable. */
  onSetup?: () => void;
  sub?: string;
  color: string; // tailwind text color class
  alarm?: 'warning' | 'critical';
  /** Numeric value for trend arrow computation (optional). */
  trendValue?: number;
  large?: boolean;
}

/**
 * A numeric tile on the monitor. Shows a trend arrow (▲/▼) when the value has
 * moved meaningfully over the last ~15 seconds, and flashes on critical alarm.
 */
export function VitalTile({
  label,
  value,
  unit,
  limits,
  alarmsOff = false,
  onSetup,
  sub,
  color,
  alarm,
  trendValue,
  large = false,
}: VitalTileProps) {
  const [trend, setTrend] = useState<'up' | 'down' | null>(null);
  const history = useRef<{ t: number; v: number }[]>([]);

  useEffect(() => {
    if (trendValue === undefined || Number.isNaN(trendValue)) {
      // No reading (lost signal): drop the arrow and start afresh when one returns.
      history.current = [];
      setTrend(null);
      return;
    }
    const now = Date.now();
    history.current.push({ t: now, v: trendValue });
    history.current = history.current.filter((h) => now - h.t <= 15000);
    const oldest = history.current[0];
    if (oldest) {
      const delta = trendValue - oldest.v;
      const threshold = Math.max(2, Math.abs(oldest.v) * 0.04);
      setTrend(delta > threshold ? 'up' : delta < -threshold ? 'down' : null);
    }
  }, [trendValue]);

  const alarmClass =
    alarm === 'critical'
      ? 'animate-alarm-flash ring-2 ring-red-500'
      : alarm === 'warning'
        ? 'ring-2 ring-yellow-400/70'
        : 'ring-1 ring-monitor-grid';

  return (
    <div
      className={`rounded-lg bg-monitor-panel px-3 py-2 ${alarmClass} ${
        onSetup ? 'cursor-pointer hover:bg-monitor-panel/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70' : ''
      }`}
      {...(onSetup
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `${label} alarm setup`,
            onClick: onSetup,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSetup();
              }
            },
          }
        : {})}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${color} opacity-80`}>
          {label}
        </span>
        <span className="flex items-baseline gap-1.5 whitespace-nowrap text-[10px] text-[#8d9688]">
          {alarmsOff ? (
            <span title="Alarms off for this measurement" aria-label="Alarms off">
              🔕
            </span>
          ) : (
            limits && (
              <span className="font-mono" title="Alarm limits">
                {limits}
              </span>
            )
          )}
          {unit && <span>{unit}</span>}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-mono font-bold leading-none ${color} ${
            large ? 'text-5xl md:text-6xl' : 'text-3xl md:text-4xl'
          }`}
        >
          {value}
        </span>
        {trend && (
          <span className={`${color} text-lg`} title={trend === 'up' ? 'rising' : 'falling'}>
            {trend === 'up' ? '▲' : '▼'}
          </span>
        )}
      </div>
      {sub && <div className="mt-0.5 text-xs font-mono text-[#a8b0a2]">{sub}</div>}
    </div>
  );
}
