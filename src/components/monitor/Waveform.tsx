'use client';

import { useEffect, useRef } from 'react';
import type { CapnoShape, PvcFrequency, Rhythm } from '@/lib/engine/types';
import { PVC_FREQUENCY_EVERY_N } from '@/lib/engine/types';
import { artSample, capnoSample, ecgSample, isPulseless, plethSample } from './waveforms';

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
  /** Freeze the trace (scenario paused / not started). */
  frozen?: boolean;
  heightClass?: string;
}

/**
 * Sweep-style waveform, like a real OR monitor: a write bar moves left to
 * right redrawing the trace in place, with a small erase gap ahead of it.
 * Rendering is wall-clock driven; beat/breath phase advances by live HR/RR.
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
  frozen = false,
  heightClass = 'h-20 md:h-24',
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ hr, rr, spo2, etco2, sbp, dbp, rhythm, capnoShape, pvcFrequency, frozen });
  live.current = { hr, rr, spo2, etco2, sbp, dbp, rhythm, capnoShape, pvcFrequency, frozen };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();
    let beatPhase = 0; // 0..1 within current beat/breath
    let beatCount = 0; // completed cycles (drives ectopy in pvc/pac)
    let x = 0; // sweep position in CSS px
    let absT = 0; // absolute seconds (for vfib noise)

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
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // px/sec. ECG/pleth/art sweep fast (~25 mm/s feel); the capnograph sweeps
    // at half that, as real monitors do — respiration is far slower than the
    // heart, so a slower CO2 sweep fits several breaths on screen and keeps
    // the capnogram morphology legible.
    const SWEEP_SPEED = kind === 'capno' ? 45 : 90;

    const sample = (): number => {
      const v = live.current;
      switch (kind) {
        case 'ecg':
          return ecgSample(v.rhythm, beatPhase, absT, beatCount, PVC_FREQUENCY_EVERY_N[v.pvcFrequency]);
        case 'pleth':
          return plethSample(v.rhythm, beatPhase, v.spo2);
        case 'capno':
          return capnoSample(beatPhase, v.rr, v.etco2, v.capnoShape);
        case 'art':
          return Math.min(ART_SCALE_MAX * 1.05, artSample(v.rhythm, beatPhase, v.sbp, v.dbp));
      }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const v = live.current;
      if (v.frozen) return;

      absT += dt;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 4) return;

      // Advance cycle phase from live rate.
      const cyclesPerSec =
        kind === 'capno'
          ? Math.max(0, v.rr) / 60
          : v.rhythm === 'vfib' || v.rhythm === 'asystole'
            ? 1 // phase unused; ecgSample uses absT
            : Math.max(0, v.hr) / 60;
      beatPhase += cyclesPerSec * dt;
      if (beatPhase >= 1) {
        beatCount += Math.floor(beatPhase);
        beatPhase %= 1;
      }

      const dx = SWEEP_SPEED * dt;
      const newX = x + dx;

      // Erase gap ahead of the write bar (wide enough to clear the glow).
      ctx.clearRect(x, 0, Math.min(dx + 18, w - x), h);
      if (newX >= w) ctx.clearRect(0, 0, 18, h);

      // Plot the segment.
      const value = sample();
      const mid = kind === 'capno' || kind === 'art' ? h * 0.94 : h * 0.55;
      const scale =
        kind === 'capno'
          ? (h * 0.79 * Math.min(1.15, Math.max(0, v.etco2) / 50)) // taller plateau at higher EtCO2, peak kept inside the canvas
          : kind === 'art'
            ? (h * 0.9) / ART_SCALE_MAX // fixed mmHg scale: 0 at baseline, 170 near the top
            : h * 0.36;
      const y = mid - value * scale;

      const prevY = (canvas as unknown as { _prevY?: number })._prevY ?? y;
      // Phosphor glow: the same tiny segment stroked wide-and-faint to
      // narrow-and-solid. Layered strokes rasterize a few hundred device
      // pixels per frame — unlike shadowBlur, which would gaussian-blur
      // every segment and drops frames on tablets.
      const strokeSegment = (width: number, alpha: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        if (newX >= w) {
          ctx.moveTo(0, y);
          ctx.lineTo(0.01, y);
        } else {
          ctx.moveTo(x, prevY);
          ctx.lineTo(newX, y);
        }
        ctx.stroke();
      };
      strokeSegment(7, 0.1);
      strokeSegment(3.5, 0.28);
      strokeSegment(2, 1);
      ctx.globalAlpha = 1;
      x = newX >= w ? 0 : newX;
      (canvas as unknown as { _prevY?: number })._prevY = y;
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
          <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
            {kind === 'pleth' ? 'no pulse detected' : 'no CO₂ detected'}
          </span>
        </div>
      )}
    </div>
  );
}
