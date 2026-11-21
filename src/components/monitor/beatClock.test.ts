import { describe, expect, it } from 'vitest';
import type { Rhythm } from '@/lib/engine/types';
import { BeatClock, type Beat, type BeatClockInput } from './beatClock';

const input = (over: Partial<BeatClockInput> = {}): BeatClockInput => ({
  hr: 60,
  rr: 0,
  rhythm: 'sinus',
  pvcEveryN: 4,
  frozen: false,
  ...over,
});

/** Run a clock for `seconds` and collect every beat it starts. */
function run(over: Partial<BeatClockInput>, seconds: number, seed = 7): Beat[] {
  const clock = new BeatClock(seed);
  clock.setInput(input(over));
  const seen = new Map<number, Beat>();
  for (let i = 0; i < seconds * 100; i++) {
    clock.advance(0.01);
    for (const b of clock.recent()) seen.set(b.index, b);
  }
  return [...seen.values()].sort((a, b) => a.index - b.index);
}

/** Intervals between consecutive beat starts. */
function intervals(beats: Beat[]): number[] {
  return beats.slice(1).map((b, i) => b.startSec - beats[i].startSec);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('BeatClock', () => {
  it('beats at 60/HR in sinus rhythm, with slight beat-to-beat variation', () => {
    for (const rhythm of ['sinus', 'sinus_brady', 'sinus_tach'] as const) {
      for (const hr of [40, 72, 150]) {
        const beats = run({ hr, rhythm }, 60);
        const rrs = intervals(beats);
        // Never more than 3% off the beat, and averaging out to the HR number…
        for (const rr of rrs) {
          expect(rr).toBeGreaterThan((60 / hr) * 0.97 - 1e-9);
          expect(rr).toBeLessThan((60 / hr) * 1.03 + 1e-9);
        }
        expect(mean(rrs)).toBeGreaterThan((60 / hr) * 0.99);
        expect(mean(rrs)).toBeLessThan((60 / hr) * 1.01);
        // …but not metronomic.
        expect(new Set(rrs.map((x) => x.toFixed(4))).size).toBeGreaterThan(rrs.length / 2);
        expect(beats.every((b) => b.kind === 'normal')).toBe(true);
      }
    }
  });

  it('keeps SVT, VT and PEA metronomic', () => {
    for (const rhythm of ['svt', 'vtach', 'pea'] as const) {
      const beats = run({ hr: 150, rhythm }, 20);
      for (const rr of intervals(beats)) expect(rr).toBeCloseTo(0.4, 6);
      expect(beats.every((b) => b.factor === 1 && b.pulse === 1)).toBe(true);
    }
  });

  it('is deterministic for a seed', () => {
    const a = run({ rhythm: 'afib', hr: 110 }, 20, 42).map((b) => b.startSec);
    const b = run({ rhythm: 'afib', hr: 110 }, 20, 42).map((b) => b.startSec);
    const c = run({ rhythm: 'afib', hr: 110 }, 20, 43).map((b) => b.startSec);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('makes atrial fibrillation irregularly irregular at the displayed mean rate', () => {
    const hr = 110;
    const rrs = intervals(run({ rhythm: 'afib', hr }, 240));
    const m = mean(rrs);
    const sd = Math.sqrt(mean(rrs.map((x) => (x - m) ** 2)));
    // Mean rate matches the HR number; spread is wide; no interval is absurd.
    expect(60 / m).toBeGreaterThan(hr * 0.95);
    expect(60 / m).toBeLessThan(hr * 1.05);
    expect(sd / m).toBeGreaterThan(0.15);
    for (const rr of rrs) {
      expect(rr).toBeGreaterThanOrEqual((60 / hr) * 0.6 - 1e-9);
      expect(rr).toBeLessThanOrEqual((60 / hr) * 1.4 + 1e-9);
    }
    // Not a repeating pattern: consecutive intervals differ.
    expect(rrs.filter((x, i) => i > 0 && Math.abs(x - rrs[i - 1]) > 0.01).length).toBeGreaterThan(
      rrs.length * 0.8,
    );
  });

  it('varies the pulse with the preceding interval in AF', () => {
    const beats = run({ rhythm: 'afib', hr: 100 }, 120);
    const rrs = intervals(beats);
    // beats[i + 1] follows interval rrs[i]: short fill → weaker pulse.
    const short = beats.slice(1).filter((_, i) => rrs[i] < 0.6 * 0.8);
    const long = beats.slice(1).filter((_, i) => rrs[i] > 0.6 * 1.2);
    expect(short.length).toBeGreaterThan(5);
    expect(long.length).toBeGreaterThan(5);
    expect(mean(short.map((b) => b.pulse))).toBeLessThan(mean(long.map((b) => b.pulse)) - 0.15);
  });

  it('places a PVC early, then a full compensatory pause', () => {
    const hr = 60;
    for (const n of [2, 3, 4, 8]) {
      const beats = run({ rhythm: 'pvc', hr, pvcEveryN: n }, 60);
      const rrs = intervals(beats);
      for (let i = 0; i < rrs.length - 1; i++) {
        const b = beats[i + 1];
        if (b.kind !== 'pvc') continue;
        // The PVC arrives early…
        expect(rrs[i]).toBeCloseTo(0.6, 6);
        // …and the gap around it spans exactly two normal cycles.
        expect(rrs[i] + rrs[i + 1]).toBeCloseTo(2, 6);
        // It barely perfuses; the beat after the pause is at least full strength.
        expect(b.pulse).toBeLessThan(0.5);
        expect(beats[i + 2].pulse).toBeGreaterThanOrEqual(1);
      }
      // One ectopic per N beats, and the mean rate still matches the HR number.
      expect(beats.filter((b) => b.kind === 'pvc').length).toBeGreaterThan(60 / n - 2);
      expect(beats.every((b) => (b.kind === 'pvc') === (b.index % n === n - 1))).toBe(true);
      expect(mean(rrs.slice(0, Math.floor(rrs.length / n) * n))).toBeCloseTo(1, 6);
    }
  });

  it('places a PAC early with a less-than-compensatory pause, one beat in five', () => {
    const beats = run({ rhythm: 'pac', hr: 60 }, 100);
    const rrs = intervals(beats);
    const normal = rrs[0];
    for (let i = 0; i < rrs.length - 1; i++) {
      if (beats[i + 1].kind !== 'pac') continue;
      expect(rrs[i]).toBeLessThan(normal * 0.8);
      expect(rrs[i] + rrs[i + 1]).toBeLessThan(2 * normal - 0.05);
      expect(rrs[i + 1]).toBeGreaterThan(normal);
    }
    expect(beats.every((b) => (b.kind === 'pac') === (b.index % 5 === 4))).toBe(true);
    expect(mean(rrs.slice(0, Math.floor(rrs.length / 5) * 5))).toBeCloseTo(1, 6);
  });

  it('starts no beats in VF or asystole and drops the ones before', () => {
    for (const rhythm of ['vfib', 'asystole'] as Rhythm[]) {
      const clock = new BeatClock();
      clock.setInput(input());
      for (let i = 0; i < 300; i++) clock.advance(0.01);
      expect(clock.recent().length).toBeGreaterThan(0);
      const before = clock.count;
      clock.setInput(input({ rhythm, hr: 0 }));
      for (let i = 0; i < 300; i++) clock.advance(0.01);
      expect(clock.recent()).toEqual([]);
      expect(clock.count).toBe(before);
    }
  });

  it('resumes beating straight away when a rhythm returns', () => {
    const clock = new BeatClock();
    clock.setInput(input({ rhythm: 'asystole', hr: 0 }));
    for (let i = 0; i < 500; i++) clock.advance(0.01);
    clock.setInput(input({ hr: 80 }));
    clock.advance(0.01);
    expect(clock.count).toBe(1);
  });

  it('starts no beats at a heart rate of zero', () => {
    expect(run({ hr: 0 }, 10)).toEqual([]);
  });

  it('holds still while frozen and carries on in step afterwards', () => {
    const clock = new BeatClock();
    clock.setInput(input({ hr: 60, rhythm: 'svt' })); // metronomic, so timing is exact
    for (let i = 0; i < 250; i++) clock.advance(0.01); // 2.5 s → three beats, 1 s apart
    const first = clock.recent()[0].startSec;
    const t = clock.t;
    const count = clock.count;
    clock.setInput(input({ hr: 60, rhythm: 'svt', frozen: true }));
    for (let i = 0; i < 1000; i++) clock.advance(0.01);
    expect(clock.t).toBe(t);
    expect(clock.count).toBe(count);
    clock.setInput(input({ hr: 60, rhythm: 'svt' }));
    for (let i = 0; i < 60; i++) clock.advance(0.01); // → 3.1 s: the fourth beat lands on time
    expect(clock.count).toBe(count + 1);
    expect(clock.recent().at(-1)?.startSec).toBeCloseTo(first + 3, 6);
  });

  it('does not sit out a long interval after the rate jumps up', () => {
    const clock = new BeatClock();
    clock.setInput(input({ hr: 20 })); // 3 s cycle
    for (let i = 0; i < 50; i++) clock.advance(0.01);
    const count = clock.count;
    clock.setInput(input({ hr: 120 }));
    for (let i = 0; i < 60; i++) clock.advance(0.01);
    // Within 0.6 s at the new rate (0.5 s cycle) a beat has fired.
    expect(clock.count).toBeGreaterThan(count);
  });

  it('keeps only a short tail of recent beats', () => {
    const clock = new BeatClock();
    clock.setInput(input({ hr: 180 }));
    for (let i = 0; i < 6000; i++) clock.advance(0.01);
    expect(clock.recent().length).toBeLessThanOrEqual(8);
    expect(clock.count).toBeGreaterThan(150);
  });

  describe('measuredRate (what the HR number is counted from)', () => {
    const rates = (over: Partial<BeatClockInput>, seconds = 120) => {
      const clock = new BeatClock(9);
      clock.setInput(input(over));
      const out: number[] = [];
      let seen = 0;
      for (let i = 0; i < seconds * 100; i++) {
        clock.advance(0.01);
        if (clock.count !== seen) {
          seen = clock.count;
          if (seen >= 8) out.push(clock.measuredRate());
        }
      }
      return out;
    };
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

    it('is exactly nominal before any beat and in metronomic rhythms', () => {
      expect(new BeatClock().measuredRate()).toBe(1);
      for (const r of rates({ rhythm: 'svt', hr: 180 }, 20)) expect(r).toBeCloseTo(1, 9);
    });

    it('wanders by about a beat in sinus rhythm', () => {
      const shown = rates({ hr: 72 }).map((r) => Math.round(72 * r));
      expect(Math.min(...shown)).toBeGreaterThanOrEqual(70);
      expect(Math.max(...shown)).toBeLessThanOrEqual(74);
      expect(new Set(shown).size).toBeGreaterThan(1); // it does move
      // …and averages out to the instructor's number.
      expect(mean(shown)).toBeGreaterThan(71.5);
      expect(mean(shown)).toBeLessThan(72.5);
    });

    it('wanders much more in AF', () => {
      expect(spread(rates({ rhythm: 'afib', hr: 110 }))).toBeGreaterThan(4 * spread(rates({ hr: 110 })));
    });

    it('holds steady through bigeminy, where pairs of beats average out', () => {
      for (const r of rates({ rhythm: 'pvc', pvcEveryN: 2, hr: 72 }, 30)) expect(r).toBeCloseTo(1, 9);
    });

    it('returns to nominal once the beats stop', () => {
      const clock = new BeatClock();
      clock.setInput(input({ rhythm: 'afib', hr: 110 }));
      for (let i = 0; i < 1000; i++) clock.advance(0.01);
      clock.setInput(input({ rhythm: 'vfib', hr: 0 }));
      clock.advance(0.01);
      expect(clock.measuredRate()).toBe(1);
    });
  });

  describe('breath phase', () => {
    /** Run for `seconds` and record each breath's length and plateau height. */
    const breaths = (rr: number, seconds: number, seed = 4) => {
      const clock = new BeatClock(seed);
      clock.setInput(input({ rr }));
      const lengths: number[] = [];
      const heights: number[] = [];
      let prev = 0;
      let startedAt = 0;
      for (let i = 0; i < seconds * 1000; i++) {
        clock.advance(0.001);
        const phase = clock.breathPhaseAt(clock.t);
        if (phase < prev) {
          lengths.push(clock.t - startedAt);
          startedAt = clock.t;
          heights.push(clock.breathHeight);
        }
        prev = phase;
      }
      return { lengths: lengths.slice(1), heights };
    };

    it('advances at the respiratory rate', () => {
      const clock = new BeatClock();
      clock.setInput(input({ rr: 12 })); // 5 s breath
      for (let i = 0; i < 125; i++) clock.advance(0.01);
      expect(clock.breathPhaseAt(clock.t)).toBeCloseTo(0.25, 6);
    });

    it('varies each breath slightly in length around 60/RR', () => {
      for (const rr of [8, 14, 30]) {
        const { lengths } = breaths(rr, 600);
        expect(lengths.length).toBeGreaterThan(rr * 9);
        for (const len of lengths) {
          expect(len).toBeGreaterThan((60 / rr) * 0.96 - 0.002);
          expect(len).toBeLessThan((60 / rr) * 1.04 + 0.002);
        }
        expect(mean(lengths)).toBeGreaterThan((60 / rr) * 0.99);
        expect(mean(lengths)).toBeLessThan((60 / rr) * 1.01);
        expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan((60 / rr) * 0.04);
      }
    });

    it('peaks each breath at or just under the EtCO2 number, never above', () => {
      const { heights } = breaths(14, 600);
      for (const h of heights) {
        expect(h).toBeLessThanOrEqual(1);
        expect(h).toBeGreaterThanOrEqual(0.96);
      }
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.025);
    });

    it('does not change which beats are drawn', () => {
      const starts = (rr: number) => run({ rhythm: 'afib', hr: 110, rr }, 30, 21).map((b) => b.startSec);
      expect(starts(14)).toEqual(starts(0));
    });

    it('answers for a moment just past, including across the wrap', () => {
      const clock = new BeatClock();
      clock.setInput(input({ rr: 12 }));
      for (let i = 0; i < 510; i++) clock.advance(0.01); // 5.1 s → phase 0.02
      // (to two places: the second breath is up to 4% off the nominal length)
      expect(clock.breathPhaseAt(clock.t)).toBeCloseTo(0.02, 2);
      expect(clock.breathPhaseAt(clock.t - 0.05)).toBeCloseTo(0.01, 2);
      expect(clock.breathPhaseAt(clock.t - 0.2)).toBeCloseTo(0.98, 2);
    });

    it('holds still at apnea and while frozen', () => {
      const clock = new BeatClock();
      clock.setInput(input({ rr: 12 }));
      for (let i = 0; i < 100; i++) clock.advance(0.01);
      const phase = clock.breathPhaseAt(clock.t);
      clock.setInput(input({ rr: 0 }));
      for (let i = 0; i < 300; i++) clock.advance(0.01);
      expect(clock.breathPhaseAt(clock.t)).toBeCloseTo(phase, 9);
      clock.setInput(input({ rr: 12, frozen: true }));
      for (let i = 0; i < 300; i++) clock.advance(0.01);
      expect(clock.breathPhaseAt(clock.t)).toBeCloseTo(phase, 9);
    });
  });

  describe('respiratory swing in the pulse', () => {
    it('makes pulses a little smaller through the breath, never larger', () => {
      const pulses = run({ rhythm: 'svt', hr: 120, rr: 12 }, 60).map((b) => b.pulse);
      expect(Math.max(...pulses)).toBeLessThanOrEqual(1);
      expect(Math.max(...pulses)).toBeGreaterThan(0.99);
      expect(Math.min(...pulses)).toBeGreaterThan(0.91);
      expect(Math.min(...pulses)).toBeLessThan(0.93);
    });

    it('follows the breath: fullest at end-inspiration, smallest mid-expiration', () => {
      const clock = new BeatClock();
      clock.setInput(input({ rhythm: 'svt', hr: 120, rr: 12 }));
      let seen = 0;
      let checked = 0;
      for (let i = 0; i < 6000; i++) {
        clock.advance(0.01);
        if (clock.count === seen) continue;
        seen = clock.count;
        const beat = clock.recent().at(-1)!;
        const phase = clock.breathPhaseAt(beat.startSec);
        expect(beat.pulse).toBeCloseTo(1 - 0.04 * (1 - Math.cos(2 * Math.PI * phase)), 6);
        checked++;
      }
      expect(checked).toBeGreaterThan(100);
    });

    it('is absent at apnea', () => {
      const pulses = run({ rhythm: 'svt', hr: 120, rr: 0 }, 30).map((b) => b.pulse);
      expect(pulses.every((p) => p === 1)).toBe(true);
    });
  });

  describe('tick (wall-clock driven)', () => {
    it('advances by elapsed time and ignores a repeated or earlier timestamp', () => {
      const clock = new BeatClock();
      clock.setInput(input());
      clock.tick(1000); // first call only anchors the timebase
      expect(clock.t).toBe(0);
      clock.tick(1016);
      expect(clock.t).toBeCloseTo(0.016, 9);
      clock.tick(1016); // a second consumer in the same frame
      clock.tick(1010); // a slightly older frame timestamp
      expect(clock.t).toBeCloseTo(0.016, 9);
      clock.tick(1033);
      expect(clock.t).toBeCloseTo(0.033, 9);
    });

    it('catches up a short stall but caps a long one', () => {
      const clock = new BeatClock();
      clock.setInput(input({ hr: 60 }));
      clock.tick(0);
      clock.tick(1500);
      expect(clock.t).toBeCloseTo(1.5, 6);
      expect(clock.count).toBe(2); // beats at 0 s and 1 s were not skipped
      clock.tick(61_500); // a minute hidden
      expect(clock.t).toBeCloseTo(3.5, 6);
    });
  });
});
