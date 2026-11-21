import { describe, expect, it } from 'vitest';
import type { Rhythm } from '@/lib/engine/types';
import { BeatClock, type Beat } from './beatClock';
import {
  ART_DELAY_MS,
  artValue,
  capnoSample,
  ecgBeat,
  ecgValue,
  isPulseless,
  PLETH_DELAY_MS,
  plethValue,
  R_OFFSET_MS,
  SUBSTEP_SEC,
} from './waveforms';

/** A single isolated beat starting at t = 0. */
function beat(over: Partial<Beat> = {}): Beat {
  const baseSec = over.baseSec ?? 60 / 72;
  return { index: 0, startSec: 0, rrSec: baseSec, baseSec, factor: 1, rhythm: 'sinus', kind: 'normal', pulse: 1, ...over };
}

/** Beats a clock produces over `seconds` (the recent tail it would hand the renderer). */
function clockAfter(rhythm: Rhythm, hr: number, seconds: number, pvcEveryN = 4): BeatClock {
  const clock = new BeatClock(3);
  clock.setInput({ hr, rr: 0, rhythm, pvcEveryN, frozen: false });
  for (let i = 0; i < seconds * 250; i++) clock.advance(0.004);
  return clock;
}

/** Times (ms) at which a sampled curve crosses `level` on the way up and down around its peak. */
function widthAt(f: (ms: number) => number, level: number, from: number, to: number): number {
  let first = NaN;
  let last = NaN;
  for (let ms = from; ms <= to; ms += 0.25) {
    if (f(ms) >= level) {
      if (Number.isNaN(first)) first = ms;
      last = ms;
    }
  }
  return last - first;
}

describe('ecgBeat', () => {
  it('peaks at the R wave, R_OFFSET_MS after the beat starts', () => {
    let peakMs = 0;
    let peak = -Infinity;
    for (let ms = 0; ms < 800; ms += 0.5) {
      const v = ecgBeat(beat(), ms);
      if (v > peak) {
        peak = v;
        peakMs = ms;
      }
    }
    expect(peakMs).toBeCloseTo(R_OFFSET_MS, 0);
    expect(peak).toBeGreaterThan(0.95);
  });

  it('keeps the QRS the same width at every heart rate', () => {
    // Regression: complexes were fractions of the beat, so the QRS was twice
    // as wide at 40 bpm as at 80 and unnaturally thin at 180.
    const widths = [40, 60, 72, 110, 150, 180].map((hr) =>
      widthAt((ms) => ecgBeat(beat({ baseSec: 60 / hr }), ms), 0.5, R_OFFSET_MS - 60, R_OFFSET_MS + 60),
    );
    for (const w of widths) expect(w).toBeCloseTo(widths[0], 1);
    expect(widths[0]).toBeGreaterThan(10);
    expect(widths[0]).toBeLessThan(25);
  });

  it('keeps the P wave a fixed time ahead of the R wave at every rate', () => {
    for (const hr of [40, 72, 150]) {
      let pMs = 0;
      let p = -Infinity;
      for (let ms = 0; ms < R_OFFSET_MS - 60; ms += 0.5) {
        const v = ecgBeat(beat({ baseSec: 60 / hr }), ms);
        if (v > p) {
          p = v;
          pMs = ms;
        }
      }
      expect(R_OFFSET_MS - pMs).toBeCloseTo(150, 0);
    }
  });

  it('brings the T wave closer to the QRS as the rate rises', () => {
    const tPeak = (hr: number) => {
      let at = 0;
      let top = -Infinity;
      for (let ms = R_OFFSET_MS + 60; ms < 900; ms += 0.5) {
        const v = ecgBeat(beat({ baseSec: 60 / hr }), ms);
        if (v > top) {
          top = v;
          at = ms;
        }
      }
      return at - R_OFFSET_MS;
    };
    expect(tPeak(72)).toBeCloseTo(208, -1);
    expect(tPeak(150)).toBeLessThan(tPeak(72));
    expect(tPeak(40)).toBeGreaterThan(tPeak(72));
  });

  it('draws a PVC as a wide complex with no P wave', () => {
    const pvc = (ms: number) => ecgBeat(beat({ rhythm: 'pvc', kind: 'pvc' }), ms);
    const sinus = (ms: number) => ecgBeat(beat(), ms);
    expect(widthAt(pvc, 0.5, 0, 500)).toBeGreaterThan(3 * widthAt(sinus, 0.5, 0, 500));
    expect(Math.abs(pvc(R_OFFSET_MS - 150))).toBeLessThan(0.02); // no P
    expect(sinus(R_OFFSET_MS - 150)).toBeGreaterThan(0.15);
  });

  it('draws a PAC as a narrow complex behind a different P wave', () => {
    const pac = (ms: number) => ecgBeat(beat({ rhythm: 'pac', kind: 'pac' }), ms);
    const sinus = (ms: number) => ecgBeat(beat(), ms);
    expect(widthAt(pac, 0.5, 0, 500)).toBeCloseTo(widthAt(sinus, 0.5, 0, 500), 1);
    expect(Math.abs(pac(R_OFFSET_MS - 150) - sinus(R_OFFSET_MS - 150))).toBeGreaterThan(0.03);
  });

  it('gives the normal beats of an ectopic rhythm the sinus complex', () => {
    for (const rhythm of ['pvc', 'pac', 'sinus_brady', 'sinus_tach'] as const) {
      for (let ms = 0; ms < 900; ms += 7) {
        expect(ecgBeat(beat({ rhythm }), ms)).toBe(ecgBeat(beat(), ms));
      }
    }
  });

  it('fills the whole cycle in VT, with no flat baseline', () => {
    const vt = beat({ rhythm: 'vtach', baseSec: 60 / 180, rrSec: 60 / 180 });
    const cycleMs = vt.rrSec * 1000;
    let quiet = 0;
    for (let ms = 0; ms < cycleMs; ms += 1) if (Math.abs(ecgBeat(vt, ms)) < 0.05) quiet++;
    expect(quiet / cycleMs).toBeLessThan(0.15);
    expect(ecgBeat(vt, cycleMs + 1)).toBe(0); // hands over to the next beat
  });

  it('contributes nothing before the beat starts or long after it', () => {
    expect(ecgBeat(beat(), -5)).toBe(0);
    expect(ecgBeat(beat({ baseSec: 2 }), 1200)).toBe(0);
  });
});

describe('ecgValue', () => {
  it('stays amplitude-bounded across every beating rhythm and rate', () => {
    const rhythms: Rhythm[] = ['sinus', 'sinus_brady', 'sinus_tach', 'pvc', 'pac', 'afib', 'svt', 'vtach', 'pea'];
    for (const rhythm of rhythms) {
      for (const hr of [30, 72, 150, 220]) {
        const clock = new BeatClock(5);
        clock.setInput({ hr, rr: 0, rhythm, pvcEveryN: 2, frozen: false });
        for (let i = 0; i < 2500; i++) {
          clock.advance(0.004);
          expect(Math.abs(ecgValue(clock.recent(), rhythm, clock.t))).toBeLessThanOrEqual(1.3);
        }
      }
    }
  });

  it('draws the R wave at full height at any frame rate when sub-stepped', () => {
    // Regression: one sample per animation frame clipped the ~20 ms R wave —
    // at 110 bpm and 60 fps about half the beats drew under 70% height.
    for (const hr of [60, 72, 110, 150, 180]) {
      const clock = new BeatClock();
      clock.setInput({ hr, rr: 0, rhythm: 'sinus', pvcEveryN: 4, frozen: false });
      const peaks = new Map<number, number>();
      // Sample on the renderer's grid, deliberately off-phase with the beats.
      for (let t = 0.0013; t < 30; t += SUBSTEP_SEC) {
        clock.advance(t - clock.t);
        const current = clock.recent().at(-1);
        if (!current) continue;
        const v = ecgValue(clock.recent(), 'sinus', t);
        peaks.set(current.index, Math.max(peaks.get(current.index) ?? -Infinity, v));
      }
      const complete = [...peaks.values()].slice(1, -1);
      expect(complete.length).toBeGreaterThan(20);
      for (const p of complete) expect(p).toBeGreaterThan(0.9);
    }
  });

  it('shows no complexes in VF or asystole, only the baseline', () => {
    const beats = clockAfter('sinus', 72, 5).recent();
    for (let t = 5; t < 6; t += 0.01) {
      expect(Math.abs(ecgValue(beats, 'asystole', t))).toBeLessThan(0.02);
    }
    const vf = Array.from({ length: 200 }, (_, i) => ecgValue([], 'vfib', i * 0.01));
    expect(Math.max(...vf) - Math.min(...vf)).toBeGreaterThan(0.8);
  });

  it('adds a fibrillatory baseline in AF and no P wave', () => {
    const b = beat({ rhythm: 'afib' });
    expect(Math.abs(ecgBeat(b, R_OFFSET_MS - 150))).toBeLessThan(0.01);
    const base = Array.from({ length: 100 }, (_, i) => ecgValue([], 'afib', i * 0.01));
    expect(Math.max(...base) - Math.min(...base)).toBeGreaterThan(0.05);
  });
});

describe('pulse traces (pleth and arterial line)', () => {
  /** Time of the trace maximum within [from, to) seconds. */
  const peakTime = (f: (t: number) => number, from: number, to: number) => {
    let at = from;
    let top = -Infinity;
    for (let t = from; t < to; t += 0.001) {
      const v = f(t);
      if (v > top) {
        top = v;
        at = t;
      }
    }
    return at;
  };

  it('time-locks each pulse to its QRS: artery first, then the finger', () => {
    const beats = [beat()];
    const rAt = R_OFFSET_MS / 1000;
    const artPeak = peakTime((t) => artValue(beats, 'sinus', t, 120, 80), 0, 1.2);
    const plethPeak = peakTime((t) => plethValue(beats, 'sinus', t, 98), 0, 1.2);
    expect(artPeak).toBeGreaterThan(rAt + ART_DELAY_MS / 1000);
    expect(plethPeak).toBeGreaterThan(rAt + PLETH_DELAY_MS / 1000);
    expect(plethPeak).toBeGreaterThan(artPeak);
    expect(plethPeak - rAt).toBeLessThan(0.5);
  });

  it('reaches systolic and settles to diastolic on the arterial trace', () => {
    const clock = clockAfter('svt', 72, 6); // metronomic: every pulse is full strength
    const samples = Array.from({ length: 1000 }, (_, i) =>
      artValue(clock.recent(), 'sinus', clock.t - 1 + i * 0.001, 120, 80),
    );
    expect(Math.max(...samples)).toBeCloseTo(120, 0);
    expect(Math.min(...samples)).toBeCloseTo(80, 0);
  });

  it('draws a weak pulse for a PVC (pulse deficit)', () => {
    const normal = [beat()];
    const pvc = [beat({ rhythm: 'pvc', kind: 'pvc', pulse: 0.35 })];
    const top = (beats: Beat[]) =>
      Math.max(...Array.from({ length: 1200 }, (_, i) => artValue(beats, 'pvc', i * 0.001, 120, 80)));
    expect(top(normal)).toBeCloseTo(120, 0);
    expect(top(pvc)).toBeLessThan(100);
    const plethTop = (beats: Beat[]) =>
      Math.max(...Array.from({ length: 1200 }, (_, i) => plethValue(beats, 'pvc', i * 0.001, 98)));
    expect(plethTop(pvc)).toBeLessThan(plethTop(normal) * 0.5);
  });

  it('varies beat to beat in AF but never exceeds the systolic number', () => {
    const clock = new BeatClock(11);
    clock.setInput({ hr: 100, rr: 0, rhythm: 'afib', pvcEveryN: 4, frozen: false });
    const tops: number[] = [];
    let top = -Infinity;
    let lastIndex = -1;
    for (let i = 0; i < 15000; i++) {
      clock.advance(0.004);
      const v = artValue(clock.recent(), 'afib', clock.t, 120, 80);
      expect(v).toBeLessThanOrEqual(120);
      const idx = clock.recent().at(-1)?.index ?? -1;
      if (idx !== lastIndex) {
        if (lastIndex >= 0) tops.push(top);
        top = -Infinity;
        lastIndex = idx;
      }
      top = Math.max(top, v);
    }
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(5);
  });

  it('goes flat in pulseless rhythms', () => {
    const beats = clockAfter('pea', 60, 5).recent();
    expect(beats.length).toBeGreaterThan(0); // PEA still has complexes…
    for (const rhythm of ['vfib', 'pea', 'asystole'] as const) {
      expect(plethValue(beats, rhythm, 5, 98)).toBe(0); // …but no pulse
      expect(artValue(beats, rhythm, 5, 120, 80)).toBe(12);
    }
  });

  it('shrinks the pleth as saturation falls', () => {
    const beats = [beat()];
    const top = (spo2: number) =>
      Math.max(...Array.from({ length: 1200 }, (_, i) => plethValue(beats, 'sinus', i * 0.001, spo2)));
    expect(top(80)).toBeLessThan(top(98));
  });

  it('keeps ectopic rhythms perfusing (pleth and pulse display stay active)', () => {
    expect(isPulseless('pvc')).toBe(false);
    expect(isPulseless('pac')).toBe(false);
  });
});

describe('capnoSample', () => {
  it('is flat when apneic or without CO2', () => {
    expect(capnoSample(0.3, 0, 40)).toBe(0);
    expect(capnoSample(0.3, 12, 0)).toBe(0);
  });

  it('never exceeds 1 and peaks at the end of the plateau (end-tidal)', () => {
    let max = -Infinity;
    let maxP = 0;
    for (let p = 0; p < 1; p += 0.0005) {
      const v = capnoSample(p, 12, 40);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      if (v > max) {
        max = v;
        maxP = p;
      }
    }
    expect(max).toBeCloseTo(1, 3);
    // The peak sits at the end of the alveolar plateau, just before the downstroke.
    expect(maxP).toBeGreaterThan(0.5);
    expect(maxP).toBeLessThan(0.56);
  });

  it('has an upsloping alveolar plateau', () => {
    const early = capnoSample(0.1, 12, 40);
    const late = capnoSample(0.54, 12, 40);
    expect(late).toBeGreaterThan(early);
  });

  it('has no vertical step between plateau and downstroke', () => {
    // Regression: the plateau used to overshoot 1 while the downstroke
    // restarted from 1, drawing a notch at the start of every downstroke.
    const dp = 0.0005;
    const endOfPlateau = capnoSample(0.55 - dp, 12, 40);
    const startOfFall = capnoSample(0.55, 12, 40);
    expect(Math.abs(startOfFall - endOfPlateau)).toBeLessThan(0.02);
  });

  it('keeps near-vertical strokes at slow respiratory rates', () => {
    // Regression: the up/downstrokes were sized as a fraction of the breath,
    // so slow rates stretched them into gradual ramps. They are fixed
    // durations now — at RR 8 (7.5 s breath) the rise is over well before
    // 5% of the cycle and the fall completes shortly after the peak.
    expect(capnoSample(0.05, 8, 40)).toBeGreaterThan(0.9);
    expect(capnoSample(0.58, 8, 40)).toBe(0);
  });

  it('returns to a zero baseline during inspiration', () => {
    expect(capnoSample(0.7, 12, 40)).toBe(0);
    expect(capnoSample(0.99, 12, 40)).toBe(0);
  });

  describe('bronchospasm (shark fin)', () => {
    it('is flat when apneic or without CO2', () => {
      expect(capnoSample(0.3, 0, 40, 'bronchospasm')).toBe(0);
      expect(capnoSample(0.3, 12, 0, 'bronchospasm')).toBe(0);
    });

    it('slurs the expiratory upstroke compared to the normal shape', () => {
      // Early in expiration the obstructed trace lags far behind normal.
      expect(capnoSample(0.1, 12, 40, 'bronchospasm')).toBeLessThan(
        capnoSample(0.1, 12, 40, 'normal') - 0.3,
      );
    });

    it('rises monotonically to the end-tidal peak with no flat plateau', () => {
      let prev = capnoSample(0, 12, 40, 'bronchospasm');
      expect(prev).toBe(0);
      for (let p = 0.001; p < 0.55; p += 0.001) {
        const v = capnoSample(p, 12, 40, 'bronchospasm');
        expect(v).toBeGreaterThan(prev);
        expect(v).toBeLessThanOrEqual(1);
        prev = v;
      }
      expect(prev).toBeCloseTo(1, 2);
    });

    it('keeps a sharp continuous downstroke and zero baseline', () => {
      const dp = 0.0005;
      const endOfRise = capnoSample(0.55 - dp, 12, 40, 'bronchospasm');
      const startOfFall = capnoSample(0.55, 12, 40, 'bronchospasm');
      expect(Math.abs(startOfFall - endOfRise)).toBeLessThan(0.02);
      expect(capnoSample(0.7, 12, 40, 'bronchospasm')).toBe(0);
    });
  });
});
