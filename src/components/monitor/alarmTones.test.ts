import { describe, expect, it } from 'vitest';
import type { AlarmState, SimSnapshot } from '@/lib/engine/types';
import {
  ALARM_EDGE_FRACTION,
  ALARM_HARMONICS,
  ALARM_PATTERNS,
  alarmTier,
  burstLengthSec,
  burstPeriodSec,
} from './alarmTones';

const warning: AlarmState = { vital: 'hr', level: 'warning', message: 'HR high 118' };
const critical: AlarmState = { vital: 'spo2', level: 'critical', message: 'SpO₂ LOW 82' };

const state = (
  alarms: AlarmState[],
  over: Partial<Pick<SimSnapshot, 'alarmsSilenced' | 'status'>> = {},
): Pick<SimSnapshot, 'alarms' | 'alarmsSilenced' | 'status'> => ({
  alarms,
  alarmsSilenced: false,
  status: 'running',
  ...over,
});

describe('alarmTier', () => {
  it('is silent with no alarms', () => {
    expect(alarmTier(state([]))).toBeNull();
  });

  it('sounds a warning on its own — warnings used to be silent', () => {
    expect(alarmTier(state([warning]))).toBe('warning');
  });

  it('sounds the highest priority present', () => {
    expect(alarmTier(state([warning, critical]))).toBe('critical');
    expect(alarmTier(state([critical]))).toBe('critical');
  });

  it('is silent while faculty has silenced alarms', () => {
    expect(alarmTier(state([warning, critical], { alarmsSilenced: true }))).toBeNull();
  });

  it('is silent unless the scenario is running', () => {
    for (const status of ['idle', 'paused', 'ended'] as const) {
      expect(alarmTier(state([critical], { status }))).toBeNull();
    }
  });
});

describe('alarm patterns (IEC 60601-1-8 tone-burst tables, 2006 + Amd 1:2012)', () => {
  const { critical: crit, warning: warn } = ALARM_PATTERNS;
  /** Silent gap after each pulse but the last. */
  const gaps = (p: typeof crit) =>
    p.pulses.slice(1).map((pulse, i) => pulse.atSec - (p.pulses[i].atSec + p.pulses[i].durSec));
  const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

  it('is ten pulses for high priority and three for medium', () => {
    expect(crit.pulses).toHaveLength(10);
    expect(warn.pulses).toHaveLength(3);
  });

  it('keeps high-priority pulses within 75–200 ms and medium within 125–250 ms', () => {
    for (const p of crit.pulses) {
      expect(p.durSec).toBeGreaterThanOrEqual(0.075);
      expect(p.durSec).toBeLessThanOrEqual(0.2);
    }
    for (const p of warn.pulses) {
      expect(p.durSec).toBeGreaterThanOrEqual(0.125);
      expect(p.durSec).toBeLessThanOrEqual(0.25);
    }
  });

  it('spaces the high-priority burst as x, x, 2x + pulse, x — twice — with x in 50–125 ms', () => {
    const [g12, g23, g34, g45, g56, g67, g78, g89, g910] = gaps(crit);
    const x = g12;
    const td = crit.pulses[0].durSec;
    expect(x).toBeGreaterThanOrEqual(0.05);
    expect(x).toBeLessThanOrEqual(0.125);
    for (const g of [g23, g45, g67, g78, g910]) near(g, x);
    near(g34, 2 * x + td);
    near(g89, 2 * x + td);
    // Between the fifth and sixth pulses: 0.35–1.30 s.
    expect(g56).toBeGreaterThanOrEqual(0.35);
    expect(g56).toBeLessThanOrEqual(1.3);
  });

  it('spaces the medium-priority burst evenly, with y in 125–250 ms', () => {
    const [g12, g23] = gaps(warn);
    expect(g12).toBeGreaterThanOrEqual(0.125);
    expect(g12).toBeLessThanOrEqual(0.25);
    near(g23, g12);
  });

  it('makes medium no faster than high: (pulse + y) ≥ (pulse + x)', () => {
    const high = crit.pulses[0].durSec + gaps(crit)[0];
    const medium = warn.pulses[0].durSec + gaps(warn)[0];
    expect(medium).toBeGreaterThanOrEqual(high);
  });

  it('repeats high after 2.5–15 s of silence and medium after 2.5–30 s, high no slower', () => {
    expect(crit.interburstSec).toBeGreaterThanOrEqual(2.5);
    expect(crit.interburstSec).toBeLessThanOrEqual(15);
    expect(warn.interburstSec).toBeGreaterThanOrEqual(2.5);
    expect(warn.interburstSec).toBeLessThanOrEqual(30);
    expect(crit.interburstSec).toBeLessThanOrEqual(warn.interburstSec);
    expect(burstPeriodSec(crit)).toBeCloseTo(burstLengthSec(crit) + crit.interburstSec, 9);
  });

  it('uses a fundamental of 150–1000 Hz with three more harmonics under 4000 Hz, within 15 dB', () => {
    expect(ALARM_HARMONICS.length).toBeGreaterThanOrEqual(4);
    for (const amplitude of ALARM_HARMONICS) {
      expect(Math.abs(20 * Math.log10(amplitude / ALARM_HARMONICS[0]))).toBeLessThanOrEqual(15);
    }
    for (const pattern of [crit, warn]) {
      expect(pattern.freq).toBeGreaterThanOrEqual(150);
      expect(pattern.freq).toBeLessThanOrEqual(1000);
      expect(pattern.freq * ALARM_HARMONICS.length).toBeLessThanOrEqual(4000);
    }
  });

  it('shapes each pulse with a rise of 10–40% of its length, at least 10 ms', () => {
    expect(ALARM_EDGE_FRACTION).toBeGreaterThanOrEqual(0.1);
    expect(ALARM_EDGE_FRACTION).toBeLessThanOrEqual(0.4);
    for (const pattern of [crit, warn]) {
      expect(pattern.pulses[0].durSec * ALARM_EDGE_FRACTION).toBeGreaterThanOrEqual(0.01);
    }
  });

  it('never overlaps pulses', () => {
    for (const pattern of [crit, warn]) {
      for (const gap of gaps(pattern)) expect(gap).toBeGreaterThan(0);
      expect(pattern.pulses[0].atSec).toBe(0);
    }
  });

  it('keeps alarm pitches clear of the pulse tone range used above 80% SpO₂', () => {
    // The pulse tone runs from 880 Hz (100%) down to about 554 Hz (80%).
    const pulseTone = (spo2: number) => 880 * Math.pow(2, (spo2 - 100) / 30);
    for (const pattern of [crit, warn]) {
      expect(pattern.freq > pulseTone(100) || pattern.freq < pulseTone(80)).toBe(true);
    }
  });
});
