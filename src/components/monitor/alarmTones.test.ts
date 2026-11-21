import { describe, expect, it } from 'vitest';
import type { AlarmState, SimSnapshot } from '@/lib/engine/types';
import { ALARM_PATTERNS, alarmTier, burstLengthSec } from './alarmTones';

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

describe('alarm patterns', () => {
  const { critical: crit, warning: warn } = ALARM_PATTERNS;

  it('is ten pulses for critical and three for a warning', () => {
    expect(crit.pulses).toHaveLength(10);
    expect(warn.pulses).toHaveLength(3);
  });

  it('groups the critical burst as three-then-two, twice', () => {
    const gaps = crit.pulses.slice(1).map((p, i) => p.atSec - (crit.pulses[i].atSec + crit.pulses[i].durSec));
    const [a, b, c, d, between, e, f, g, h] = gaps;
    // Within a group: two short gaps, a longer one, a short one.
    for (const gap of [a, b, d, e, f, h]) expect(gap).toBeCloseTo(a, 6);
    expect(c).toBeGreaterThan(a * 1.5);
    expect(g).toBeCloseTo(c, 6);
    // And a clear pause between the two groups.
    expect(between).toBeGreaterThan(c * 2);
  });

  it('makes critical faster, higher and more frequent than a warning', () => {
    expect(crit.freq).toBeGreaterThan(warn.freq);
    expect(crit.pulses[0].durSec).toBeLessThan(warn.pulses[0].durSec);
    expect(crit.repeatSec).toBeLessThan(warn.repeatSec);
  });

  it('never overlaps pulses, and leaves silence before the burst repeats', () => {
    for (const pattern of [crit, warn]) {
      for (let i = 1; i < pattern.pulses.length; i++) {
        const prev = pattern.pulses[i - 1];
        expect(pattern.pulses[i].atSec).toBeGreaterThan(prev.atSec + prev.durSec);
      }
      expect(pattern.pulses[0].atSec).toBe(0);
      expect(pattern.repeatSec - burstLengthSec(pattern)).toBeGreaterThan(1.5);
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
