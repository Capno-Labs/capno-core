import type { SimSnapshot } from '@/lib/engine/types';

/**
 * Audible alarm patterns, by priority.
 *
 * A critical alarm sounds as a repeating ten-pulse burst (two groups of
 * three-then-two); a warning as a slower, lower three-pulse burst repeated
 * less often. That follows the general convention for medical alarm sounds —
 * faster, higher and more insistent as priority rises — but the pitches and
 * timings here are this project's own and make no claim to meet a standard.
 *
 * Framework-free: the patterns are data, and the browser layer
 * (MonitorAudio) only schedules them.
 */

export type AlarmTier = 'critical' | 'warning';

export interface TonePulse {
  /** Start of the pulse, seconds from the start of the burst. */
  atSec: number;
  durSec: number;
}

export interface AlarmPattern {
  /** Pitch of every pulse in the burst, Hz. */
  freq: number;
  /** Peak gain of each pulse (before the monitor's volume setting). */
  gain: number;
  pulses: TonePulse[];
  /** Start of one burst to the start of the next, seconds. */
  repeatSec: number;
}

/** Three pulses, a longer gap, two pulses. */
function threeThenTwo(startSec: number, durSec: number, gapSec: number): TonePulse[] {
  const step = durSec + gapSec;
  return [0, step, 2 * step, 3 * step + gapSec, 4 * step + gapSec].map((at) => ({
    atSec: startSec + at,
    durSec,
  }));
}

export const ALARM_PATTERNS: Record<AlarmTier, AlarmPattern> = {
  critical: {
    freq: 1047,
    gain: 0.2,
    pulses: [...threeThenTwo(0, 0.12, 0.08), ...threeThenTwo(1.7, 0.12, 0.08)],
    repeatSec: 5,
  },
  warning: {
    freq: 523,
    gain: 0.16,
    pulses: [0, 0.4, 0.8].map((atSec) => ({ atSec, durSec: 0.22 })),
    repeatSec: 10,
  },
};

/** Seconds from the start of a burst to the end of its last pulse. */
export function burstLengthSec(pattern: AlarmPattern): number {
  return Math.max(...pattern.pulses.map((p) => p.atSec + p.durSec));
}

/**
 * Which alarm sound, if any, the monitor should be making: the highest
 * priority among the active alarms — none while the scenario is not running
 * or faculty has silenced alarms.
 */
export function alarmTier(
  snapshot: Pick<SimSnapshot, 'alarms' | 'alarmsSilenced' | 'status'>,
): AlarmTier | null {
  if (snapshot.status !== 'running' || snapshot.alarmsSilenced) return null;
  if (snapshot.alarms.some((a) => a.level === 'critical')) return 'critical';
  if (snapshot.alarms.some((a) => a.level === 'warning')) return 'warning';
  return null;
}
