import { describe, expect, it } from 'vitest';
import type { Rhythm } from '@/lib/engine/types';
import { BeatClock, FIRST_DEGREE_PR_MS, P_MS, WENCKEBACH_PR_MS, type Beat } from './beatClock';
import {
  AF_FIB_PER_MIN,
  ART_DELAY_MS,
  capnoScaleMax,
  dissociatedAtrialPeriodSec,
  FLUTTER_ATRIAL_PER_MIN,
  flutterRatio,
  TORSADES_PER_MIN,
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
  return {
    index: 0,
    startSec: 0,
    rrSec: baseSec,
    baseSec,
    factor: 1,
    rhythm: 'sinus',
    kind: 'normal',
    rMs: R_OFFSET_MS,
    conducted: true,
    pulse: 1,
    ...over,
  };
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

describe('drawn intervals against published normal ranges', () => {
  /** First and last times the complex is off the baseline by more than `eps`. */
  const span = (f: (ms: number) => number, from: number, to: number, eps = 0.02) => {
    let first = NaN;
    let last = NaN;
    for (let ms = from; ms <= to; ms += 0.5) {
      if (Math.abs(f(ms)) > eps) {
        if (Number.isNaN(first)) first = ms;
        last = ms;
      }
    }
    return { first, last };
  };
  const oneSecond = beat({ baseSec: 1, rrSec: 1 }); // 60 bpm, so QT = QTc
  const draw = (ecg = {}) => (ms: number) => ecgBeat(oneSecond, ms, ecg);

  it('has a PR interval of 120–200 ms', () => {
    const pOnset = span(draw(), 0, R_OFFSET_MS - 70).first;
    const qrsOnset = span(draw({ tWave: 'flat' }), R_OFFSET_MS - 65, R_OFFSET_MS + 80).first;
    expect(qrsOnset - pOnset).toBeGreaterThanOrEqual(120);
    expect(qrsOnset - pOnset).toBeLessThanOrEqual(200);
  });

  it('has a normal QRS of 60–100 ms and a wide one of at least 120 ms', () => {
    const qrsSpan = (ecg: object) => {
      const { first, last } = span(draw({ ...ecg, tWave: 'flat' }), R_OFFSET_MS - 90, R_OFFSET_MS + 130, 0.05);
      return last - first;
    };
    expect(qrsSpan({})).toBeGreaterThanOrEqual(60);
    expect(qrsSpan({})).toBeLessThanOrEqual(100);
    expect(qrsSpan({ qrs: 'wide' })).toBeGreaterThanOrEqual(120);
  });

  it('has a normal QTc under 450 ms and a prolonged one over 500 ms', () => {
    const qt = (ecg: object) => {
      const qrsOnset = span(draw({ ...ecg, tWave: 'flat' }), R_OFFSET_MS - 65, R_OFFSET_MS + 60).first;
      const tEnd = span(draw(ecg), R_OFFSET_MS + 100, 1000).last;
      return tEnd - qrsOnset;
    };
    expect(qt({})).toBeGreaterThan(350);
    expect(qt({})).toBeLessThan(450);
    expect(qt({ qt: 'long' })).toBeGreaterThan(500);
    expect(qt({ qt: 'long' })).toBeLessThan(580);
  });

  it('shortens the QT with the square root of the cycle (Bazett)', () => {
    const tPeakAfterR = (hr: number) => {
      const b = beat({ baseSec: 60 / hr });
      let at = 0;
      let top = -Infinity;
      for (let ms = R_OFFSET_MS + 60; ms < 900; ms += 0.5) {
        const v = ecgBeat(b, ms);
        if (v > top) {
          top = v;
          at = ms;
        }
      }
      return at - R_OFFSET_MS;
    };
    for (const hr of [50, 100, 150]) {
      expect(tPeakAfterR(hr) / tPeakAfterR(60)).toBeCloseTo(Math.sqrt(60 / hr), 2);
    }
  });

  it('keeps the normal T wave under 5 mm and the peaked one above it', () => {
    const tTop = (ecg: object) => Math.max(...Array.from({ length: 1400 }, (_, i) => draw(ecg)(R_OFFSET_MS + 100 + i * 0.5)));
    expect(tTop({}) * 10).toBeLessThan(5);
    expect(tTop({ tWave: 'peaked' }) * 10).toBeGreaterThan(5);
  });

  it('runs the fibrillatory waves of AF at 350–500 per minute', () => {
    for (const perMin of AF_FIB_PER_MIN) {
      expect(perMin).toBeGreaterThanOrEqual(350);
      expect(perMin).toBeLessThanOrEqual(500);
    }
  });
});

describe('ECG morphology (ST, T wave, QRS width, QT)', () => {
  const b = beat(); // sinus, 72 bpm
  const at = (ms: number, ecg = {}) => ecgBeat(b, ms, ecg);
  /** Mid ST segment: after the QRS, before the T wave begins to rise. */
  const ST_MS = R_OFFSET_MS + 90;
  const tPeakOf = (ecg = {}, beatOver = b) => {
    let peakAt = 0;
    let top = 0;
    for (let ms = R_OFFSET_MS + 80; ms < 1000; ms += 0.5) {
      const v = ecgBeat(beatOver, ms, ecg);
      if (Math.abs(v) > Math.abs(top)) {
        top = v;
        peakAt = ms;
      }
    }
    return { ms: peakAt - R_OFFSET_MS, value: top };
  };

  it('draws exactly the normal complex when nothing is set', () => {
    for (let ms = 0; ms < 900; ms += 3) {
      expect(at(ms, {})).toBe(at(ms));
      expect(at(ms, { stMm: 0, tWave: 'normal', qrs: 'normal', qt: 'normal' })).toBe(at(ms));
    }
  });

  it('moves the ST segment by a tenth of the R wave per millimetre', () => {
    for (const stMm of [-3, -2, -1, 1, 2, 4]) {
      expect(at(ST_MS, { stMm }) - at(ST_MS)).toBeCloseTo(stMm * 0.1, 2);
    }
    // Depression goes down, elevation up.
    expect(at(ST_MS, { stMm: -2 })).toBeLessThan(at(ST_MS));
    expect(at(ST_MS, { stMm: 2 })).toBeGreaterThan(at(ST_MS));
  });

  it('leaves the P wave, the R wave and the baseline after the T wave alone', () => {
    for (const stMm of [-4, 4]) {
      expect(at(R_OFFSET_MS - 150, { stMm })).toBeCloseTo(at(R_OFFSET_MS - 150), 3); // P
      expect(at(R_OFFSET_MS, { stMm })).toBeCloseTo(at(R_OFFSET_MS), 2); // R peak
      expect(at(700, { stMm })).toBeCloseTo(0, 2); // back on the baseline
    }
  });

  it('carries the T wave on the shifted segment', () => {
    // At the moment the normal T wave peaks, the trace is 2 mm lower.
    const normal = tPeakOf();
    const tMs = R_OFFSET_MS + normal.ms;
    expect(at(tMs, { stMm: -2 })).toBeCloseTo(normal.value - 0.2, 1);
    expect(at(tMs, { stMm: 3 })).toBeCloseTo(normal.value + 0.3, 1);
  });

  it('draws a peaked T wave taller and narrower', () => {
    const normal = tPeakOf();
    const peaked = tPeakOf({ tWave: 'peaked' });
    expect(peaked.value).toBeGreaterThan(normal.value * 1.8);
    const half = (ecg: object, top: number) =>
      widthAt((ms) => at(ms, ecg), top / 2, R_OFFSET_MS + 80, 900);
    expect(half({ tWave: 'peaked' }, peaked.value)).toBeLessThan(half({}, normal.value) * 0.75);
    expect(peaked.ms).toBeCloseTo(normal.ms, 0); // same place
  });

  it('draws a flattened T wave small and an inverted one below the baseline', () => {
    const normal = tPeakOf();
    expect(Math.abs(tPeakOf({ tWave: 'flat' }).value)).toBeLessThan(normal.value * 0.3);
    expect(tPeakOf({ tWave: 'inverted' }).value).toBeLessThan(-normal.value * 0.6);
  });

  it('widens the QRS past 120 ms and delays what follows', () => {
    const width = (ecg: object) => {
      // Span over which the trace is away from baseline around the QRS.
      let first = NaN;
      let last = NaN;
      for (let ms = R_OFFSET_MS - 100; ms < R_OFFSET_MS + 130; ms += 0.5) {
        if (Math.abs(at(ms, { ...ecg, tWave: 'flat' })) > 0.08) {
          if (Number.isNaN(first)) first = ms;
          last = ms;
        }
      }
      return last - first;
    };
    expect(width({})).toBeLessThan(110);
    expect(width({ qrs: 'wide' })).toBeGreaterThan(120);
    expect(width({ qrs: 'wide' })).toBeGreaterThan(width({}) * 1.5);
    expect(tPeakOf({ qrs: 'wide' }).ms).toBeGreaterThan(tPeakOf().ms + 20);
    // The R wave still peaks where the pulse tone fires.
    expect(at(R_OFFSET_MS, { qrs: 'wide' })).toBeGreaterThan(0.9);
  });

  it('moves the T wave later for a prolonged QT, at every rate', () => {
    for (const hr of [50, 72, 110]) {
      const beatAt = beat({ baseSec: 60 / hr });
      const normal = tPeakOf({}, beatAt).ms;
      const long = tPeakOf({ qt: 'long' }, beatAt).ms;
      expect(long).toBeGreaterThan(normal * 1.4);
      expect(long).toBeLessThan(normal * 1.6);
    }
  });

  it('reshapes AF, SVT and PAC beats too', () => {
    for (const over of [{ rhythm: 'afib' }, { rhythm: 'svt' }, { rhythm: 'pac', kind: 'pac' }] as const) {
      const other = beat(over);
      expect(ecgBeat(other, ST_MS, { stMm: -2 }) - ecgBeat(other, ST_MS)).toBeCloseTo(-0.2, 2);
    }
  });

  it('leaves PVCs, VT and PEA as they were', () => {
    const everything = { stMm: -4, tWave: 'peaked', qrs: 'wide', qt: 'long' } as const;
    const unaffected = [
      beat({ rhythm: 'pvc', kind: 'pvc' }),
      beat({ rhythm: 'vtach', baseSec: 0.35, rrSec: 0.35 }),
      beat({ rhythm: 'pea' }),
    ];
    for (const other of unaffected) {
      for (let ms = 0; ms < 900; ms += 5) {
        expect(ecgBeat(other, ms, everything)).toBe(ecgBeat(other, ms));
      }
    }
  });

  it('stays inside the trace area at the extremes', () => {
    // The renderer has room for about +1.5 above and −1.25 below the baseline.
    const extremes = [
      { stMm: 5, tWave: 'peaked', qrs: 'wide', qt: 'long' },
      { stMm: -5, tWave: 'inverted', qrs: 'wide', qt: 'long' },
      { stMm: 5, tWave: 'peaked' },
      { stMm: -5, tWave: 'inverted' },
    ] as const;
    for (const ecg of extremes) {
      for (const hr of [40, 72, 150]) {
        const clock = new BeatClock(2);
        clock.setInput({ hr, rr: 0, rhythm: 'sinus', pvcEveryN: 4, frozen: false });
        for (let i = 0; i < 2000; i++) {
          clock.advance(0.004);
          const v = ecgValue(clock.recent(), 'sinus', clock.t, ecg);
          expect(v).toBeLessThan(1.5);
          expect(v).toBeGreaterThan(-1.25);
        }
      }
    }
  });
});

describe('V5 lead', () => {
  const b = beat();
  const ST_MS = R_OFFSET_MS + 90;
  const ii = (ms: number, ecg = {}) => ecgBeat(b, ms, ecg, 'II');
  const v5 = (ms: number, ecg = {}) => ecgBeat(b, ms, ecg, 'V5');

  it('reads its own ST level, independent of lead II', () => {
    const ecg = { stMm: -3, stV5Mm: -1 };
    expect(v5(ST_MS, ecg) - v5(ST_MS)).toBeCloseTo(-0.1, 2);
    expect(ii(ST_MS, ecg) - ii(ST_MS)).toBeCloseTo(-0.3, 2);
    // Ischemia in V5 that lead II misses.
    const lateral = { stV5Mm: -2 };
    expect(v5(ST_MS, lateral) - v5(ST_MS)).toBeCloseTo(-0.2, 2);
    expect(ii(ST_MS, lateral)).toBe(ii(ST_MS));
  });

  it('defaults to lead II when no lead is named', () => {
    for (let ms = 0; ms < 800; ms += 7) expect(ecgBeat(b, ms, { stMm: -2 })).toBe(ii(ms, { stMm: -2 }));
  });

  it('shows a small septal q, a dominant R and a smaller s than lead II', () => {
    const q = Math.min(...Array.from({ length: 60 }, (_, i) => v5(R_OFFSET_MS - 60 + i)));
    const r = v5(R_OFFSET_MS);
    const s = Math.min(...Array.from({ length: 60 }, (_, i) => v5(R_OFFSET_MS + 15 + i)));
    const sInII = Math.min(...Array.from({ length: 60 }, (_, i) => ii(R_OFFSET_MS + 15 + i)));
    expect(r).toBeGreaterThan(0.9);
    expect(q).toBeLessThan(0); // a q wave is there…
    expect(Math.abs(q)).toBeLessThan(0.25 * r); // …under a quarter of the R wave
    expect(Math.abs(q) * 10).toBeLessThan(2); // …and under 2 mm deep (Meek & Morris 2002)
    const qWidth = widthAt((ms) => -v5(ms), Math.abs(q) / 2, R_OFFSET_MS - 60, R_OFFSET_MS - 12);
    expect(qWidth).toBeLessThan(40); // …and under 40 ms wide
    expect(Math.abs(s)).toBeLessThan(Math.abs(sInII));
    expect(Math.abs(s)).toBeLessThan(0.25 * r);
  });

  it('has upright P and T waves', () => {
    expect(v5(P_MS)).toBeGreaterThan(0.1);
    const t = Math.max(...Array.from({ length: 600 }, (_, i) => v5(R_OFFSET_MS + 100 + i * 0.5)));
    expect(t).toBeGreaterThan(0.2);
  });

  it('takes the T-wave, QRS and QT settings like lead II', () => {
    const tTop = (ecg: object) => Math.max(...Array.from({ length: 1400 }, (_, i) => v5(R_OFFSET_MS + 100 + i * 0.5, ecg)));
    expect(tTop({ tWave: 'peaked' })).toBeGreaterThan(tTop({}) * 1.8);
    const tMin = Math.min(...Array.from({ length: 1400 }, (_, i) => v5(R_OFFSET_MS + 100 + i * 0.5, { tWave: 'inverted' })));
    expect(tMin).toBeLessThan(-0.15);
    expect(widthAt((ms) => v5(ms, { qrs: 'wide' }), 0.5, 0, 500)).toBeGreaterThan(
      widthAt((ms) => v5(ms), 0.5, 0, 500) * 1.5,
    );
  });

  it('draws ectopic, paced and ventricular complexes as in lead II', () => {
    const same = [
      beat({ rhythm: 'pvc', kind: 'pvc' }),
      beat({ rhythm: 'vtach', baseSec: 0.35, rrSec: 0.35 }),
      beat({ rhythm: 'paced' }),
      beat({ rhythm: 'idioventricular' }),
      beat({ rhythm: 'pea' }),
    ];
    for (const other of same) {
      for (let ms = 0; ms < 800; ms += 5) {
        expect(ecgBeat(other, ms, { stV5Mm: -3 }, 'V5')).toBe(ecgBeat(other, ms, {}, 'II'));
      }
    }
  });

  it('follows the same beats as lead II — one rhythm, two views', () => {
    const clock = new BeatClock(4);
    clock.setInput({ hr: 80, rr: 0, rhythm: 'afib', pvcEveryN: 4, frozen: false });
    let rInII = 0;
    let rInV5 = 0;
    let prevII = 0;
    let prevV5 = 0;
    for (let i = 0; i < 7500; i++) {
      clock.advance(0.004);
      const a = ecgValue(clock.recent(), 'afib', clock.t, {}, 'II');
      const c = ecgValue(clock.recent(), 'afib', clock.t, {}, 'V5');
      if (prevII < 0.6 && a >= 0.6) rInII++;
      if (prevV5 < 0.6 && c >= 0.6) rInV5++;
      prevII = a;
      prevV5 = c;
    }
    expect(rInV5).toBe(rInII);
    expect(rInII).toBeGreaterThan(30);
  });
});

describe('added rhythms', () => {
  /** First and last times a curve is off the baseline by more than `eps`. */
  const offBaseline = (f: (ms: number) => number, from: number, to: number, eps: number) => {
    let first = NaN;
    let last = NaN;
    for (let ms = from; ms <= to; ms += 0.5) {
      if (Math.abs(f(ms)) > eps) {
        if (Number.isNaN(first)) first = ms;
        last = ms;
      }
    }
    return { first, last, span: last - first };
  };
  const flatT = { tWave: 'flat' } as const;

  it('draws a non-conducted beat as a P wave with nothing after it', () => {
    const dropped = beat({ rhythm: 'av_block_mobitz1', conducted: false, pulse: 0 });
    expect(ecgBeat(dropped, P_MS)).toBeCloseTo(0.18, 2);
    for (let ms = P_MS + 90; ms < 900; ms += 5) expect(Math.abs(ecgBeat(dropped, ms))).toBeLessThan(0.01);
  });

  it('first-degree block: a PR interval over 200 ms, every P followed by a QRS', () => {
    const b = beat({ rhythm: 'av_block_1', rMs: P_MS + FIRST_DEGREE_PR_MS });
    const pOnset = offBaseline((ms) => ecgBeat(b, ms), 0, 150, 0.02).first;
    const qrsOnset = offBaseline((ms) => ecgBeat(b, ms, flatT), 200, 420, 0.02).first;
    expect(qrsOnset - pOnset).toBeGreaterThan(200);
    expect(qrsOnset - pOnset).toBeLessThan(300);
    expect(ecgBeat(b, P_MS + FIRST_DEGREE_PR_MS)).toBeGreaterThan(0.95); // the R wave, later
  });

  it('Mobitz I: each conducted beat of the group has a longer PR than the last', () => {
    const pr = WENCKEBACH_PR_MS.map((peakToPeak) => {
      const b = beat({ rhythm: 'av_block_mobitz1', rMs: P_MS + peakToPeak });
      const pOnset = offBaseline((ms) => ecgBeat(b, ms), 0, 150, 0.02).first;
      const qrsOnset = offBaseline((ms) => ecgBeat(b, ms, flatT), 150, 450, 0.02).first;
      return qrsOnset - pOnset;
    });
    expect(pr[0]).toBeGreaterThanOrEqual(120); // the first is a normal PR…
    expect(pr[0]).toBeLessThanOrEqual(200);
    expect(pr[1]).toBeGreaterThan(pr[0]);
    expect(pr[2]).toBeGreaterThan(pr[1]); // …the last the longest
  });

  it('Mobitz II: conducted beats have a wide QRS, whatever the QRS setting', () => {
    const b = beat({ rhythm: 'av_block_mobitz2' });
    const span = offBaseline((ms) => ecgBeat(b, ms, flatT), R_OFFSET_MS - 90, R_OFFSET_MS + 130, 0.05).span;
    expect(span).toBeGreaterThanOrEqual(120);
    const narrow = offBaseline((ms) => ecgBeat(beat(), ms, flatT), R_OFFSET_MS - 90, R_OFFSET_MS + 130, 0.05).span;
    expect(narrow).toBeLessThanOrEqual(100);
  });

  it('junctional rhythm: a narrow QRS with no P wave', () => {
    const b = beat({ rhythm: 'junctional', baseSec: 1.2, rrSec: 1.2 });
    for (let ms = 0; ms < R_OFFSET_MS - 60; ms += 2) expect(Math.abs(ecgBeat(b, ms))).toBeLessThan(0.01);
    const span = offBaseline((ms) => ecgBeat(b, ms, flatT), R_OFFSET_MS - 90, R_OFFSET_MS + 130, 0.05).span;
    expect(span).toBeLessThanOrEqual(100);
  });

  it('complete block: P waves at their own regular rate, faster than and unrelated to the QRS', () => {
    const hr = 45;
    const clock = new BeatClock(3);
    clock.setInput({ hr, rr: 0, rhythm: 'av_block_3', pvcEveryN: 4, frozen: false });
    const period = dissociatedAtrialPeriodSec(60 / hr);
    expect(60 / period).toBeGreaterThan(hr); // atrial rate faster than ventricular
    // Count P waves and QRS complexes over a minute.
    let p = 0;
    let qrs = 0;
    let prev = 0;
    const prToNextR: number[] = [];
    let lastPAt = -1;
    for (let i = 0; i < 60 * 500; i++) {
      clock.advance(0.002);
      const v = ecgValue(clock.recent(), 'av_block_3', clock.t);
      // Rising through a level only a P wave (0.18) or a QRS (1.0) reaches.
      if (prev < 0.12 && v >= 0.12) {
        const rSoon = clock.recent().some((b) => Math.abs(clock.t - (b.startSec + b.rMs / 1000)) < 0.03);
        if (rSoon) {
          qrs++;
          if (lastPAt >= 0) prToNextR.push(clock.t - lastPAt);
        } else {
          p++;
          lastPAt = clock.t;
        }
      }
      prev = v;
    }
    expect(qrs).toBeGreaterThanOrEqual(hr - 2);
    expect(qrs).toBeLessThanOrEqual(hr + 1);
    expect(p).toBeGreaterThan(qrs + 10);
    // No fixed PR: the P-to-QRS time keeps changing.
    expect(Math.max(...prToNextR) - Math.min(...prToNextR)).toBeGreaterThan(0.2);
  });

  it('atrial flutter: conducts 2:1 near 150/min and 4:1 near 75, keeping the atrial rate in range', () => {
    expect(flutterRatio(60 / 150)).toBe(2);
    expect(flutterRatio(60 / 75)).toBe(4);
    expect(flutterRatio(60 / 100)).toBe(3);
    expect(flutterRatio(60 / 45)).toBe(6); // a slow ventricular rate needs a higher ratio
    for (const hr of [35, 45, 55, 70, 75, 85, 100, 130, 150, 170]) {
      const atrial = hr * flutterRatio(60 / hr);
      expect(atrial).toBeGreaterThanOrEqual(FLUTTER_ATRIAL_PER_MIN.min);
      expect(atrial).toBeLessThanOrEqual(FLUTTER_ATRIAL_PER_MIN.max);
    }
  });

  it('atrial flutter: sawtooth waves with no flat baseline between them', () => {
    const b = beat({ rhythm: 'aflutter', baseSec: 0.8, rrSec: 0.8 }); // 75/min, 4:1
    // Past the QRS, the trace never sits still for 60 ms.
    for (let ms = R_OFFSET_MS + 120; ms < 740; ms += 10) {
      const window = Array.from({ length: 30 }, (_, i) => ecgBeat(b, ms + i * 2));
      expect(Math.max(...window) - Math.min(...window)).toBeGreaterThan(0.02);
    }
    // Four waves per beat: a quick return (steep rise) ends each, and one of
    // the four hides under the QRS.
    let returns = 0;
    let rising = false;
    for (let ms = 0; ms < 800; ms += 1) {
      const slope = ecgBeat(b, ms + 1) - ecgBeat(b, ms);
      const steepUp = slope > 0.003 && Math.abs(ms - R_OFFSET_MS) > 60;
      if (steepUp && !rising) returns++;
      rising = steepUp;
    }
    expect(returns).toBe(3);
  });

  it('torsades: fast complexes at 160–240/min whose size swells, shrinks and flips', () => {
    expect(TORSADES_PER_MIN).toBeGreaterThanOrEqual(160);
    expect(TORSADES_PER_MIN).toBeLessThanOrEqual(240);
    const v = Array.from({ length: 12000 }, (_, i) => ecgValue([], 'torsades', i * 0.001));
    // Peak size over successive half-second windows varies widely…
    const windows = Array.from({ length: 24 }, (_, w) => Math.max(...v.slice(w * 500, w * 500 + 500).map(Math.abs)));
    expect(Math.max(...windows)).toBeGreaterThan(0.8);
    expect(Math.min(...windows)).toBeLessThan(0.45);
    // …and the complexes come at about the stated rate.
    const crossings = v.slice(1).filter((x, i) => x >= 0 !== v[i] >= 0).length;
    const perMin = (crossings / 2 / 12) * 60;
    expect(perMin).toBeGreaterThan(160);
    expect(perMin).toBeLessThan(260);
  });

  it('paced rhythm: a spike, then a wide QRS that is mainly negative in lead II', () => {
    const b = beat({ rhythm: 'paced', baseSec: 1, rrSec: 1 });
    const spike = Math.max(...Array.from({ length: 40 }, (_, i) => ecgBeat(b, R_OFFSET_MS - 90 + i)));
    expect(spike).toBeGreaterThan(0.5);
    expect(ecgBeat(b, R_OFFSET_MS)).toBeLessThan(-0.6);
    const span = offBaseline((ms) => ecgBeat(b, ms), R_OFFSET_MS - 30, R_OFFSET_MS + 70, 0.1).span;
    expect(span).toBeGreaterThanOrEqual(100);
    // The T wave points the other way (secondary repolarization change).
    expect(ecgBeat(b, R_OFFSET_MS + 84)).toBeGreaterThan(0.2);
    // No P wave.
    expect(Math.abs(ecgBeat(b, P_MS))).toBeLessThan(0.01);
  });

  it('idioventricular rhythm: wide complexes with no P waves', () => {
    const b = beat({ rhythm: 'idioventricular', baseSec: 1.7, rrSec: 1.7 });
    expect(Math.abs(ecgBeat(b, P_MS))).toBeLessThan(0.01);
    const half = widthAt((ms) => ecgBeat(b, ms), 0.45, 0, 500);
    expect(half).toBeGreaterThan(60); // far wider than the ~17 ms of a normal R wave at half height
    expect(ecgBeat(b, R_OFFSET_MS + 84)).toBeLessThan(-0.2);
  });

  it('ignores the morphology settings in flutter, paced and idioventricular rhythms', () => {
    const everything = { stMm: -4, tWave: 'peaked', qrs: 'wide', qt: 'long' } as const;
    for (const rhythm of ['aflutter', 'paced', 'idioventricular'] as const) {
      const b = beat({ rhythm });
      for (let ms = 0; ms < 800; ms += 5) expect(ecgBeat(b, ms, everything)).toBe(ecgBeat(b, ms));
    }
  });

  it('times the pulse from each beat\'s own R wave, and gives a dropped beat none', () => {
    const delayed = [beat({ rhythm: 'av_block_1', rMs: P_MS + FIRST_DEGREE_PR_MS })];
    const normal = [beat()];
    const peakAt = (beats: Beat[]) => {
      let at = 0;
      let top = -Infinity;
      for (let t = 0; t < 1.4; t += 0.001) {
        const v = artValue(beats, false, t, 120, 80);
        if (v > top) {
          top = v;
          at = t;
        }
      }
      return at;
    };
    expect(peakAt(delayed) - peakAt(normal)).toBeCloseTo((P_MS + FIRST_DEGREE_PR_MS - R_OFFSET_MS) / 1000, 2);
    const dropped = [beat({ conducted: false, pulse: 0 })];
    for (let t = 0; t < 1.2; t += 0.01) expect(artValue(dropped, false, t, 120, 80)).toBe(80);
  });
});

describe('ecgValue', () => {
  it('stays amplitude-bounded across every beating rhythm and rate', () => {
    const rhythms: Rhythm[] = [
      'sinus',
      'sinus_brady',
      'sinus_tach',
      'pvc',
      'pac',
      'afib',
      'svt',
      'vtach',
      'pea',
      'av_block_1',
      'av_block_mobitz1',
      'av_block_mobitz2',
      'av_block_3',
      'junctional',
      'aflutter',
      'torsades',
      'paced',
      'idioventricular',
    ];
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

  it('uses pulse arrival times inside the measured ranges', () => {
    // Radial line 140–232 ms (Escobar-Restrepo 2018); finger 230–330 ms (Kortekaas 2018).
    expect(ART_DELAY_MS).toBeGreaterThanOrEqual(140);
    expect(ART_DELAY_MS).toBeLessThanOrEqual(232);
    expect(PLETH_DELAY_MS).toBeGreaterThanOrEqual(230);
    expect(PLETH_DELAY_MS).toBeLessThanOrEqual(330);
  });

  it('shortens the pulse wave as the rate rises, by the ejection-time regression', () => {
    // Time from the start of the upstroke to the dicrotic wave, at each rate.
    const upstrokeToDicrotic = (hr: number) => {
      const b = [beat({ baseSec: 60 / hr, rrSec: 60 / hr })];
      const onset = (R_OFFSET_MS + ART_DELAY_MS) / 1000;
      let dicroticAt = 0;
      let prev = -Infinity;
      let rising = false;
      // Find the second local maximum (the dicrotic bump) after the systolic peak.
      let peaks = 0;
      for (let t = onset; t < onset + 0.9; t += 0.0005) {
        const v = artValue(b, false, t, 120, 80);
        if (v > prev) rising = true;
        else if (rising && v < prev) {
          peaks += 1;
          rising = false;
          if (peaks === 2) {
            dicroticAt = t - onset;
            break;
          }
        }
        prev = v;
      }
      return dicroticAt * 1000;
    };
    const lvet = (hr: number) => 244 - 0.926 * hr + 1.08 * 70; // Charlton 2019
    for (const hr of [60, 100, 140]) {
      expect(upstrokeToDicrotic(hr) / upstrokeToDicrotic(75)).toBeCloseTo(lvet(hr) / lvet(75), 1);
    }
    expect(upstrokeToDicrotic(140)).toBeLessThan(upstrokeToDicrotic(60));
  });

  it('time-locks each pulse to its QRS: artery first, then the finger', () => {
    const beats = [beat()];
    const rAt = R_OFFSET_MS / 1000;
    const artPeak = peakTime((t) => artValue(beats, false, t, 120, 80), 0, 1.2);
    const plethPeak = peakTime((t) => plethValue(beats, false, t, 98), 0, 1.2);
    expect(artPeak).toBeGreaterThan(rAt + ART_DELAY_MS / 1000);
    expect(plethPeak).toBeGreaterThan(rAt + PLETH_DELAY_MS / 1000);
    expect(plethPeak).toBeGreaterThan(artPeak);
    expect(plethPeak - rAt).toBeLessThan(0.5);
  });

  it('reaches systolic and settles to diastolic on the arterial trace', () => {
    const clock = clockAfter('svt', 72, 6); // metronomic: every pulse is full strength
    const samples = Array.from({ length: 1000 }, (_, i) =>
      artValue(clock.recent(), false, clock.t - 1 + i * 0.001, 120, 80),
    );
    expect(Math.max(...samples)).toBeCloseTo(120, 0);
    expect(Math.min(...samples)).toBeCloseTo(80, 0);
  });

  it('draws a weak pulse for a PVC (pulse deficit)', () => {
    const normal = [beat()];
    const pvc = [beat({ rhythm: 'pvc', kind: 'pvc', pulse: 0.35 })];
    const top = (beats: Beat[]) =>
      Math.max(...Array.from({ length: 1200 }, (_, i) => artValue(beats, false, i * 0.001, 120, 80)));
    expect(top(normal)).toBeCloseTo(120, 0);
    expect(top(pvc)).toBeLessThan(100);
    const plethTop = (beats: Beat[]) =>
      Math.max(...Array.from({ length: 1200 }, (_, i) => plethValue(beats, false, i * 0.001, 98)));
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
      const v = artValue(clock.recent(), false, clock.t, 120, 80);
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

  it('goes flat with no pulse, whatever the rhythm on the ECG', () => {
    // Beats are still there — PEA and pulseless VT have complexes — but no pulse.
    const beats = clockAfter('sinus', 60, 5).recent();
    expect(beats.length).toBeGreaterThan(0);
    for (let t = 4; t < 5; t += 0.05) {
      expect(plethValue(beats, true, t, 98)).toBe(0);
      expect(artValue(beats, true, t, 120, 80)).toBe(12);
    }
    const withPulse = Array.from({ length: 200 }, (_, i) => artValue(beats, false, 4 + i * 0.005, 120, 80));
    expect(Math.max(...withPulse)).toBeGreaterThan(110);
  });

  it('shrinks the pleth as saturation falls', () => {
    const beats = [beat()];
    const top = (spo2: number) =>
      Math.max(...Array.from({ length: 1200 }, (_, i) => plethValue(beats, false, i * 0.001, spo2)));
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

describe('capnogram: rebreathing, cardiogenic oscillations and leak', () => {
  const phases = Array.from({ length: 2000 }, (_, i) => i / 2000);

  it('raises the baseline to the inspired CO2 and keeps the peak at EtCO2', () => {
    const etco2 = 40;
    const fico2 = 8;
    const mmHg = phases.map((p) => capnoSample(p, 12, etco2, 'normal', { fico2 }) * etco2);
    expect(Math.min(...mmHg)).toBeCloseTo(fico2, 6); // never below the inspired level
    expect(Math.max(...mmHg)).toBeCloseTo(etco2, 2); // the peak is still the EtCO2 number
    // During inspiration the trace sits at the inspired level, not zero.
    expect(capnoSample(0.8, 12, etco2, 'normal', { fico2 }) * etco2).toBeCloseTo(fico2, 6);
    expect(capnoSample(0.8, 12, etco2, 'normal') * etco2).toBe(0);
  });

  it('draws exactly the old trace when inspired CO2 is zero or absent', () => {
    for (const shape of ['normal', 'bronchospasm', 'curare_cleft'] as const) {
      for (const p of phases) {
        expect(capnoSample(p, 12, 40, shape, { fico2: 0 })).toBe(capnoSample(p, 12, 40, shape));
      }
    }
  });

  it('stays flat at apnea whatever the inspired CO2', () => {
    expect(capnoSample(0.3, 0, 40, 'normal', { fico2: 8 })).toBe(0);
  });

  it('cardiogenic: no sharp downstroke — the trace drifts down in ripples that keep time with the heart', () => {
    const hr = 80;
    const rr = 8; // a long expiration: 7.5 s per breath
    const breathSec = 60 / rr;
    const at = (p: number) => capnoSample(p, rr, 40, 'cardiogenic', { heartbeats: (p * breathSec * hr) / 60 });
    const v = phases.map(at);
    expect(Math.max(...v)).toBeCloseTo(1, 2); // the peak is still the EtCO2 number
    for (const x of v) expect(x).toBeLessThanOrEqual(1 + 1e-9);
    // Where a normal breath has already fallen to zero, this one is still coming down…
    expect(capnoSample(0.62, rr, 40, 'normal')).toBe(0);
    expect(at(0.62)).toBeGreaterThan(0.3);
    // …and it is back on the baseline before the next breath.
    expect(at(0.95)).toBe(0);
    // Ripples: one per heartbeat over the tail.
    const tail = phases.filter((p) => p > 0.47 && p < 0.9);
    let ripples = 0;
    for (let i = 1; i < tail.length - 1; i++) {
      if (at(tail[i]) > at(tail[i - 1]) && at(tail[i]) >= at(tail[i + 1])) ripples++;
    }
    const heartbeatsInTail = ((0.9 - 0.47) * breathSec * hr) / 60;
    expect(ripples).toBeGreaterThanOrEqual(Math.floor(heartbeatsInTail) - 1);
    expect(ripples).toBeLessThanOrEqual(Math.ceil(heartbeatsInTail) + 1);
  });

  it('leak: peaks early, then sags instead of holding a plateau', () => {
    const v = phases.map((p) => capnoSample(p, 12, 40, 'leak'));
    const peakAt = phases[v.indexOf(Math.max(...v))];
    expect(Math.max(...v)).toBeCloseTo(1, 6);
    expect(peakAt).toBeLessThan(0.12);
    const endOfExpiration = capnoSample(0.54, 12, 40, 'leak');
    expect(endOfExpiration).toBeLessThan(0.65);
    expect(endOfExpiration).toBeGreaterThan(0.4);
    // Falling all the way through expiration.
    for (let p = 0.12; p < 0.54; p += 0.01) {
      expect(capnoSample(p + 0.01, 12, 40, 'leak')).toBeLessThan(capnoSample(p, 12, 40, 'leak'));
    }
    expect(capnoSample(0.8, 12, 40, 'leak')).toBe(0);
  });

  it('esophageal: the breath has the normal shape — its height comes from the falling EtCO2', () => {
    for (const p of phases) expect(capnoSample(p, 12, 10, 'esophageal')).toBe(capnoSample(p, 12, 10, 'normal'));
  });

  it('uses a 0–50 mmHg scale, stepping to 0–75 once the reading passes 50', () => {
    for (const etco2 of [0, 20, 36, 50]) expect(capnoScaleMax(etco2)).toBe(50);
    for (const etco2 of [51, 60, 92]) expect(capnoScaleMax(etco2)).toBe(75);
  });
});

