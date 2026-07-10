import { describe, expect, it } from 'vitest';
import { capnoSample, ecgSample, isPulseless } from './waveforms';

describe('ecgSample ectopy (pvc/pac)', () => {
  const phases = Array.from({ length: 200 }, (_, i) => i / 200);

  it('renders normal sinus complexes on non-ectopic beats', () => {
    for (const rhythm of ['pvc', 'pac'] as const) {
      for (let beat = 0; beat < 3; beat++) {
        for (const p of phases) {
          expect(ecgSample(rhythm, p, 0, beat)).toBe(ecgSample('sinus', p, 0));
        }
      }
    }
  });

  it('renders a materially different complex on the ectopic beat', () => {
    // pvc: every 4th beat; pac: every 5th.
    for (const [rhythm, ectopicBeat] of [['pvc', 3], ['pac', 4]] as const) {
      const maxDiff = Math.max(
        ...phases.map((p) => Math.abs(ecgSample(rhythm, p, 0, ectopicBeat) - ecgSample('sinus', p, 0))),
      );
      expect(maxDiff).toBeGreaterThan(0.3);
    }
  });

  it('stays amplitude-bounded across a run of beats', () => {
    for (const rhythm of ['pvc', 'pac'] as const) {
      for (let beat = 0; beat < 10; beat++) {
        for (const p of phases) {
          expect(Math.abs(ecgSample(rhythm, p, 0, beat))).toBeLessThanOrEqual(1.3);
        }
      }
    }
  });

  it('is not pulseless (pleth and pulse display stay active)', () => {
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
