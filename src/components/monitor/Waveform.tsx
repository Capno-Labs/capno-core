'use client';

import { useEffect, useRef } from 'react';
import type { CapnoShape, EcgMorphology, PvcFrequency, Rhythm } from '@/lib/engine/types';
import { PVC_FREQUENCY_EVERY_N } from '@/lib/engine/types';
import { BeatClock } from './beatClock';
import { artValue, capnoSample, ecgValue, isPulseless, plethValue, SUBSTEP_SEC } from './waveforms';

export type TraceKind = 'ecg' | 'pleth' | 'capno' | 'art';

/** Fixed arterial scale (mmHg) — hypotension visibly lowers the trace. */
const ART_SCALE_MAX = 170;

interface WaveformProps {
  kind: TraceKind;
  color: string;
  /** Live vitals — read every animation frame via a ref, no re-render needed. */
  hr: number;
  rr: number;
  spo2: number;
  etco2: number;
  /** Live pressures (art traces only). */
  sbp?: number;
  dbp?: number;
  rhythm: Rhythm;
  /** Capnograph morphology (capno traces only). Absent = normal. */
  capnoShape?: CapnoShape;
  /** PVC coupling rate (ecg traces only). Absent = occasional (1 in 4). */
  pvcFrequency?: PvcFrequency;
  /** Complex morphology — ST, T wave, QRS width, QT (ecg traces only). */
  ecg?: EcgMorphology;
  /** Freeze the trace (scenario paused / not started). */
  frozen?: boolean;
  /**
   * The monitor's shared beat/breath clock. The owner keeps its input
   * current. Omit it and the trace runs a private clock — correct on its
   * own, but not locked to any other trace.
   */
  clock?: BeatClock;
  heightClass?: string;
}

/** Longest stretch of trace drawn in one frame; a longer gap (a stalled or
 *  hidden tab) is skipped rather than drawn as one long catch-up stroke. */
const MAX_FRAME_SEC = 0.05;
/** Erase gap ahead of the write bar, CSS px (wide enough to clear the glow). */
const ERASE_AHEAD_PX = 18;

/**
 * Sweep-style waveform, like a real OR monitor: a write bar moves left to
 * right redrawing the trace in place, with a small erase gap ahead of it.
 * Cardiac traces plot the beats of a shared BeatClock and the capnogram its
 * breath phase. Each frame is plotted in several short sub-steps so narrow
 * features (the R wave) keep their full height.
 */
export function Waveform({
  kind,
  color,
  hr,
  rr,
  spo2,
  etco2,
  sbp = 0,
  dbp = 0,
  rhythm,
  capnoShape = 'normal',
  pvcFrequency = 'occasional',
  ecg,
  frozen = false,
  clock,
  heightClass = 'h-20 md:h-24',
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ hr, rr, spo2, etco2, sbp, dbp, rhythm, capnoShape, pvcFrequency, ecg, frozen });
  live.current = { hr, rr, spo2, etco2, sbp, dbp, rhythm, capnoShape, pvcFrequency, ecg, frozen };

  // A trace without a shared clock keeps a private one fed from props.
  const ownClock = useRef<BeatClock | null>(null);
  if (!clock) {
    ownClock.current ??= new BeatClock(Date.now());
    ownClock.current.setInput({
      hr,
      rr,
      rhythm,
      pvcEveryN: PVC_FREQUENCY_EVERY_N[pvcFrequency],
      frozen,
    });
  }
  const clockRef = useRef<BeatClock | null>(null);
  clockRef.current = clock ?? ownClock.current;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastClockT: number | null = null; // clock time already drawn
    let x = 0; // sweep position in CSS px
    let prevY: number | null = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Canvas is transparent; the wrapper's .wave-graticule owns the
      // background, so cleared areas reveal the grid.
      ctx.clearRect(0, 0, rect.width, rect.height);
      x = 0;
      prevY = null;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // px/sec. ECG/pleth/art sweep fast (~25 mm/s feel); the capnograph sweeps
    // at half that, as real monitors do — respiration is far slower than the
    // heart, so a slower CO2 sweep fits several breaths on screen and keeps
    // the capnogram morphology legible.
    const SWEEP_SPEED = kind === 'capno' ? 45 : 90;

    /** Trace value at clock time `t`. */
    const sample = (beatClock: BeatClock, t: number): number => {
      const v = live.current;
      const beats = beatClock.recent();
      switch (kind) {
        case 'ecg':
          return ecgValue(beats, v.rhythm, t, v.ecg);
        case 'pleth':
          return plethValue(beats, v.rhythm, t, v.spo2);
        case 'capno':
          // Each breath's plateau peaks at or just under the EtCO2 number.
          return (
            capnoSample(beatClock.breathPhaseAt(t), v.rr, v.etco2, v.capnoShape) * beatClock.breathHeight
          );
        case 'art':
          return Math.min(ART_SCALE_MAX * 1.05, artValue(beats, v.rhythm, t, v.sbp, v.dbp));
      }
    };

    // Phosphor glow: the same short path stroked wide-and-faint to
    // narrow-and-solid. Layered strokes rasterize a few hundred device
    // pixels per frame — unlike shadowBlur, which would gaussian-blur
    // every segment and drops frames on tablets.
    const strokeGlow = (points: number[]) => {
      if (points.length < 4) return;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [width, alpha] of [
        [7, 0.1],
        [3.5, 0.28],
        [2, 1],
      ] as const) {
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const v = live.current;

      // How much trace time to draw this frame, and where it ends. The clock
      // stands still while frozen, so dt is 0 and nothing draws.
      const beatClock = clockRef.current;
      if (!beatClock) return;
      beatClock.tick(now);
      const endT = beatClock.t;
      const dt = lastClockT === null ? 0 : Math.min(MAX_FRAME_SEC, endT - lastClockT);
      lastClockT = endT;
      if (dt <= 0) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 4) return;

      const mid = kind === 'capno' || kind === 'art' ? h * 0.94 : h * 0.55;
      const scale =
        kind === 'capno'
          ? (h * 0.79 * Math.min(1.15, Math.max(0, v.etco2) / 50)) // taller plateau at higher EtCO2, peak kept inside the canvas
          : kind === 'art'
            ? (h * 0.9) / ART_SCALE_MAX // fixed mmHg scale: 0 at baseline, 170 near the top
            : h * 0.36;

      // Erase gap ahead of the write bar, wrapping past the right edge.
      const ahead = SWEEP_SPEED * dt + ERASE_AHEAD_PX;
      ctx.clearRect(x, 0, Math.min(ahead, w - x), h);
      if (x + ahead > w) ctx.clearRect(0, 0, x + ahead - w, h);

      // Plot the frame as a run of short sub-steps.
      const steps = Math.max(1, Math.ceil(dt / SUBSTEP_SEC));
      const stepSec = dt / steps;
      let points: number[] = prevY === null ? [] : [x, prevY];
      for (let i = 1; i <= steps; i++) {
        const y = mid - sample(beatClock, endT - dt + i * stepSec) * scale;
        x += SWEEP_SPEED * stepSec;
        if (x >= w) {
          // Sweep wrapped: finish the stroke at the right edge, restart at the left.
          points.push(w, y);
          strokeGlow(points);
          x -= w;
          points = [0, y];
        }
        points.push(x, y);
        prevY = y;
      }
      strokeGlow(points);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [kind, color]);

  const flat =
    (kind === 'pleth' && isPulseless(rhythm)) || (kind === 'capno' && (rr <= 0 || etco2 <= 0));

  return (
    <div className={`wave-graticule relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      {flat && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-mono uppercase tracking-widest text-[#8d9688]">
            {kind === 'pleth' ? 'no pulse detected' : 'no CO₂ detected'}
          </span>
        </div>
      )}
    </div>
  );
}
