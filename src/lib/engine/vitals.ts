import type { AlarmState, NumericVitals, Vitals } from './types';
import { NUMERIC_VITAL_KEYS } from './types';

/** Display metadata for each numeric vital (units, formatting, slider range). */
export interface VitalMeta {
  key: keyof NumericVitals;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

export const VITAL_META: Record<keyof NumericVitals, VitalMeta> = {
  hr: { key: 'hr', label: 'HR', unit: 'bpm', min: 0, max: 220, step: 1, decimals: 0 },
  sbp: { key: 'sbp', label: 'SBP', unit: 'mmHg', min: 0, max: 260, step: 1, decimals: 0 },
  dbp: { key: 'dbp', label: 'DBP', unit: 'mmHg', min: 0, max: 160, step: 1, decimals: 0 },
  spo2: { key: 'spo2', label: 'SpO₂', unit: '%', min: 0, max: 100, step: 1, decimals: 0 },
  etco2: { key: 'etco2', label: 'EtCO₂', unit: 'mmHg', min: 0, max: 120, step: 1, decimals: 0 },
  rr: { key: 'rr', label: 'RR', unit: '/min', min: 0, max: 60, step: 1, decimals: 0 },
  temp: { key: 'temp', label: 'Temp', unit: '°C', min: 30, max: 44, step: 0.1, decimals: 1 },
  depth: { key: 'depth', label: 'Depth', unit: '', min: 0, max: 100, step: 1, decimals: 0 },
  agentEt: { key: 'agentEt', label: 'Et Sev', unit: '%', min: 0, max: 8, step: 0.1, decimals: 1 },
  agentFi: { key: 'agentFi', label: 'Fi Sev', unit: '%', min: 0, max: 8, step: 0.1, decimals: 1 },
};

export const DEFAULT_VITALS: Vitals = {
  hr: 72,
  sbp: 120,
  dbp: 75,
  spo2: 98,
  etco2: 36,
  rr: 14,
  temp: 36.6,
  depth: 95,
  agentEt: 0,
  agentFi: 0,
  rhythm: 'sinus',
};

/** Clamp a numeric vital to its physically renderable range. */
export function clampVital(key: keyof NumericVitals, value: number): number {
  const m = VITAL_META[key];
  return Math.min(m.max, Math.max(m.min, value));
}

/** Minimum systolic−diastolic gap the sim will display (mmHg). A narrower
 *  pulse pressure isn't a plausible monitor reading, so both the engine and
 *  scenario validation enforce it. */
export const MIN_PULSE_PRESSURE = 20;

/** Highest diastolic allowed for a given systolic: sbp − MIN_PULSE_PRESSURE,
 *  floored at 0 so arrest states (0/0) stay representable. */
export function maxDbpFor(sbp: number): number {
  return Math.max(0, sbp - MIN_PULSE_PRESSURE);
}

export function roundVital(key: keyof NumericVitals, value: number): number {
  const f = 10 ** VITAL_META[key].decimals;
  return Math.round(value * f) / f;
}

interface AlarmLimit {
  vital: keyof NumericVitals;
  warnLow?: number;
  warnHigh?: number;
  critLow?: number;
  critHigh?: number;
}

/** Adult intraoperative default alarm limits (deliberately conventional). */
const ALARM_LIMITS: AlarmLimit[] = [
  { vital: 'hr', warnLow: 50, warnHigh: 110, critLow: 40, critHigh: 140 },
  { vital: 'sbp', warnLow: 90, warnHigh: 160, critLow: 70, critHigh: 200 },
  { vital: 'spo2', warnLow: 92, critLow: 85 },
  { vital: 'etco2', warnLow: 25, warnHigh: 50, critLow: 15, critHigh: 60 },
  { vital: 'rr', warnLow: 8, warnHigh: 24, critLow: 4, critHigh: 35 },
  { vital: 'temp', warnLow: 35.0, warnHigh: 38.0, critHigh: 39.5 },
];

const LETHAL_RHYTHMS = new Set(['vtach', 'vfib', 'pea', 'asystole']);

/** Evaluate the current vitals against alarm limits. */
export function evaluateAlarms(vitals: Vitals): AlarmState[] {
  const alarms: AlarmState[] = [];

  if (LETHAL_RHYTHMS.has(vitals.rhythm)) {
    alarms.push({
      vital: 'rhythm',
      level: 'critical',
      message: `RHYTHM: ${vitals.rhythm.toUpperCase().replace('_', ' ')}`,
    });
  }

  for (const lim of ALARM_LIMITS) {
    const v = vitals[lim.vital];
    const meta = VITAL_META[lim.vital];
    if (lim.critLow !== undefined && v < lim.critLow) {
      alarms.push({ vital: lim.vital, level: 'critical', message: `${meta.label} LOW ${v.toFixed(meta.decimals)}` });
    } else if (lim.critHigh !== undefined && v > lim.critHigh) {
      alarms.push({ vital: lim.vital, level: 'critical', message: `${meta.label} HIGH ${v.toFixed(meta.decimals)}` });
    } else if (lim.warnLow !== undefined && v < lim.warnLow) {
      alarms.push({ vital: lim.vital, level: 'warning', message: `${meta.label} low ${v.toFixed(meta.decimals)}` });
    } else if (lim.warnHigh !== undefined && v > lim.warnHigh) {
      alarms.push({ vital: lim.vital, level: 'warning', message: `${meta.label} high ${v.toFixed(meta.decimals)}` });
    }
  }

  return alarms;
}

export { NUMERIC_VITAL_KEYS };
