import type { SimSnapshot } from '@/lib/engine/types';

/**
 * Audible alarm patterns, by priority.
 *
 * The bursts are timed to the tone-burst tables of IEC 60601-1-8 (2006, with
 * Amendment 1:2012) — the "3 + 2, 3 + 2" ten-pulse high-priority burst and
 * the three-pulse medium-priority burst — using the values reproduced in
 * Texas Instruments application report SLOA273 (2019) and the x/y spacing
 * values in the IEC Amendment 1 text:
 *
 *   high    pulse 75–200 ms; spacing x = 50–125 ms; between pulses 3–4 and
 *           8–9: 2x + pulse; between pulses 5–6: 0.35–1.30 s; burst repeats
 *           after 2.5–15 s
 *   medium  pulse 125–250 ms; spacing y = 125–250 ms; burst repeats after
 *           2.5–30 s; (pulse + y) must not be shorter than high's (pulse + x)
 *   both    fundamental 150–1000 Hz with at least three further harmonics
 *           below 4000 Hz, each within 15 dB of the fundamental; rise time
 *           10–40% of the pulse
 *
 * The standard sets priority apart by rhythm and speed, not pitch (Edworthy,
 * Forum Acusticum 2023), so the higher critical pitch here is this project's
 * choice within the allowed range. Only the timing and spectrum are followed:
 * sound level, the rest of the standard, and Amendment 2's auditory icons
 * are not addressed, and this is a teaching simulator, not an alarm system.
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
  /** Fundamental of every pulse in the burst, Hz. */
  freq: number;
  /** Peak gain of each pulse (before the monitor's volume setting). */
  gain: number;
  pulses: TonePulse[];
  /** Silence between the end of one burst and the start of the next, seconds. */
  interburstSec: number;
}

/**
 * Relative amplitude of the fundamental and its 2nd–4th harmonics. All are
 * within 15 dB of the fundamental (the quietest is −12 dB).
 */
export const ALARM_HARMONICS: readonly number[] = [1, 0.5, 0.35, 0.25];

/** Rise and fall of each pulse, as a fraction of its duration. */
export const ALARM_EDGE_FRACTION = 0.15;

/** High priority: five pulses as three-then-two, with spacing x. */
function threeThenTwo(startSec: number, durSec: number, x: number): TonePulse[] {
  const p1 = startSec;
  const p2 = p1 + durSec + x;
  const p3 = p2 + durSec + x;
  const p4 = p3 + durSec + (2 * x + durSec); // the longer gap that makes the rhythm
  const p5 = p4 + durSec + x;
  return [p1, p2, p3, p4, p5].map((atSec) => ({ atSec, durSec }));
}

const HIGH_PULSE_SEC = 0.12;
const HIGH_X_SEC = 0.08;
/** Gap between the fifth and sixth pulses. */
const HIGH_MID_GAP_SEC = 0.7;
const highFirst = threeThenTwo(0, HIGH_PULSE_SEC, HIGH_X_SEC);
const highSecondStart = highFirst[4].atSec + HIGH_PULSE_SEC + HIGH_MID_GAP_SEC;

const MEDIUM_PULSE_SEC = 0.22;
const MEDIUM_Y_SEC = 0.18;

export const ALARM_PATTERNS: Record<AlarmTier, AlarmPattern> = {
  critical: {
    freq: 988,
    gain: 0.2,
    pulses: [...highFirst, ...threeThenTwo(highSecondStart, HIGH_PULSE_SEC, HIGH_X_SEC)],
    interburstSec: 3,
  },
  warning: {
    freq: 523,
    gain: 0.16,
    pulses: [0, 1, 2].map((i) => ({
      atSec: i * (MEDIUM_PULSE_SEC + MEDIUM_Y_SEC),
      durSec: MEDIUM_PULSE_SEC,
    })),
    interburstSec: 9,
  },
};

/** Seconds from the start of a burst to the end of its last pulse. */
export function burstLengthSec(pattern: AlarmPattern): number {
  return Math.max(...pattern.pulses.map((p) => p.atSec + p.durSec));
}

/** Start of one burst to the start of the next, seconds. */
export function burstPeriodSec(pattern: AlarmPattern): number {
  return burstLengthSec(pattern) + pattern.interburstSec;
}

/**
 * Which alarm sound, if any, the monitor should be making: the highest
 * priority among the active alarms nobody has silenced — none while the
 * scenario is not running or faculty has paused alarms. Acknowledging "switches
 * off the audible alarm indicators" (Philips IntelliVue MX750/MX850
 * Instructions for Use, "Acknowledging Alarms").
 */
export function alarmTier(
  snapshot: Pick<SimSnapshot, 'alarms' | 'alarmsSilenced' | 'status'>,
): AlarmTier | null {
  if (snapshot.status !== 'running' || snapshot.alarmsSilenced) return null;
  const sounding = snapshot.alarms.filter((a) => !a.acknowledged);
  if (sounding.some((a) => a.level === 'critical')) return 'critical';
  if (sounding.some((a) => a.level === 'warning')) return 'warning';
  return null;
}
