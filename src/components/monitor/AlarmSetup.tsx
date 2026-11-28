'use client';

import type { AlarmParam, AlarmSide } from '@/lib/engine/types';
import type { DisplaySnapshot } from '@/lib/sync/displaySnapshot';
import { ALARM_PARAM_META, ALARM_PROFILES, ALARM_SET_KEYS } from '@/lib/engine/vitals';

/**
 * What the alarm setup can do. Passed only where the monitor may be
 * operated: the faculty preview acts on the session directly; a student
 * display sends each press as a request and the session applies it. Limits
 * move one press at a time so that presses made before the next snapshot
 * arrives are neither lost nor doubled.
 */
export interface AlarmSetupActions {
  stepLimit: (vital: AlarmParam, side: AlarmSide, direction: -1 | 1) => void;
  setOff: (vital: AlarmParam, off: boolean) => void;
  /** The Silence key: acknowledge the alarms active now. */
  silence: () => void;
}

const SIDE_LABEL: Record<AlarmSide, string> = { high: 'High', low: 'Low' };

function LimitRow({
  vital,
  side,
  value,
  critical,
  disabled,
  onStep,
}: {
  vital: AlarmParam;
  side: AlarmSide;
  value: number | undefined;
  critical: number | undefined;
  disabled: boolean;
  onStep: (direction: -1 | 1) => void;
}) {
  const meta = ALARM_PARAM_META[vital];
  // An off limit sits at the end of the range: stepping inward switches it on.
  const end = side === 'low' ? meta.min : meta.max;
  const current = value ?? end;
  const fmt = (n: number) => n.toFixed(meta.decimals);
  const name = `${meta.label} ${SIDE_LABEL[side].toLowerCase()} alarm limit`;
  const btn =
    'h-8 w-8 rounded bg-monitor-bg text-lg leading-none text-monitor-ink ring-1 ring-monitor-grid hover:bg-monitor-panel disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-xs uppercase tracking-wider text-[#a8b0a2]">{SIDE_LABEL[side]}</span>
      <button
        className={btn}
        disabled={disabled || current <= meta.min}
        onClick={() => onStep(-1)}
        aria-label={`Lower ${name}`}
      >
        −
      </button>
      <span
        className="w-14 text-center font-mono text-xl font-bold tabular-nums text-yellow-300"
        aria-label={name}
      >
        {value === undefined ? 'off' : fmt(value)}
      </span>
      <button
        className={btn}
        disabled={disabled || current >= meta.max}
        onClick={() => onStep(1)}
        aria-label={`Raise ${name}`}
      >
        +
      </button>
      <span className="font-mono text-xs text-red-400" title="Critical limit — follows only if the limit passes it">
        {critical === undefined ? '' : `crit ${fmt(critical)}`}
      </span>
    </div>
  );
}

/**
 * The monitor's alarm setup for one numeric, opened by selecting it — as a
 * Philips IntelliVue's measurement alarm-limits window: the high and low
 * (yellow) limits are set here, the critical (red) limits are shown but not
 * set, and an Alarms On/Off key switches this measurement's alarms. A
 * machine reading has a single limit a side (and inspired oxygen only a low
 * one), so it shows only the rows it has and no critical value.
 */
export function AlarmSetup({
  vitals,
  snapshot,
  actions,
  onClose,
}: {
  vitals: AlarmParam[];
  snapshot: DisplaySnapshot;
  actions: AlarmSetupActions;
  onClose: () => void;
}) {
  const limits = snapshot.alarmLimits ?? ALARM_PROFILES.adult;
  const off = snapshot.alarmsOff ?? [];
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-2"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Alarm setup"
        className="max-h-full w-full max-w-sm space-y-3 overflow-y-auto rounded-lg bg-monitor-panel p-3 text-monitor-ink ring-1 ring-monitor-grid"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-[#a8b0a2]">Alarm setup</span>
          <button
            className="rounded px-2 py-0.5 text-sm ring-1 ring-monitor-grid hover:bg-monitor-bg"
            onClick={onClose}
            aria-label="Close alarm setup"
          >
            Close ✕
          </button>
        </div>
        {vitals.map((vital) => {
          // Limits archived before the machine's were adjustable carry none.
          const band = limits[vital] ?? ALARM_PROFILES.adult[vital];
          const isOff = off.includes(vital);
          const meta = ALARM_PARAM_META[vital];
          const keys = ALARM_SET_KEYS[vital];
          // The view-only critical value belongs to a vital's warning limit.
          const crit = (side: AlarmSide) =>
            keys[side] === (side === 'low' ? 'warnLow' : 'warnHigh')
              ? band[side === 'low' ? 'critLow' : 'critHigh']
              : undefined;
          return (
            <div key={vital} className="space-y-2 rounded bg-monitor-bg/60 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold uppercase tracking-wider">
                  {meta.label}
                  {meta.unit && <span className="ml-1 text-xs font-normal text-[#8d9688]">{meta.unit}</span>}
                </span>
                <button
                  className={`rounded px-2 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${
                    isOff
                      ? 'bg-red-500/20 text-red-300 ring-red-500/60'
                      : 'bg-monitor-bg text-monitor-ink ring-monitor-grid hover:bg-monitor-panel'
                  }`}
                  onClick={() => actions.setOff(vital, !isOff)}
                  aria-pressed={!isOff}
                  aria-label={`${meta.label} alarms ${isOff ? 'off — switch on' : 'on — switch off'}`}
                >
                  {isOff ? '🔕 Alarms off' : '🔔 Alarms on'}
                </button>
              </div>
              {(['high', 'low'] as const).map((side) => {
                const key = keys[side];
                return key ? (
                  <LimitRow
                    key={side}
                    vital={vital}
                    side={side}
                    value={band[key]}
                    critical={crit(side)}
                    disabled={isOff}
                    onStep={(direction) => actions.stepLimit(vital, side, direction)}
                  />
                ) : null;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
