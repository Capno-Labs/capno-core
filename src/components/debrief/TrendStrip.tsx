'use client';

import type { LogEntry, VitalsHistorySample } from '@/lib/engine/types';

/**
 * Vitals-over-time trend strip for the debrief report. Hand-drawn inline SVG
 * (no chart dependency, crisp in print). Event markers let the debrief anchor
 * "when it happened" against "when the team responded".
 */

const SERIES: {
  key: keyof Omit<VitalsHistorySample, 't'>;
  label: string;
  color: string;
  min: number;
  max: number;
}[] = [
  { key: 'hr', label: 'HR', color: '#16a34a', min: 0, max: 180 },
  { key: 'sbp', label: 'SBP', color: '#dc2626', min: 0, max: 220 },
  { key: 'spo2', label: 'SpO₂', color: '#0284c7', min: 50, max: 100 },
  { key: 'etco2', label: 'EtCO₂', color: '#ca8a04', min: 0, max: 100 },
];

const W = 720;
const H = 150;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 22;

function fmt(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

export function TrendStrip({
  history,
  log,
}: {
  history: VitalsHistorySample[];
  log: LogEntry[];
}) {
  if (history.length < 2) return null;

  const t0 = history[0].t;
  const t1 = history[history.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
  const y = (value: number, min: number, max: number) => {
    const clamped = Math.min(max, Math.max(min, value));
    return PAD_T + (1 - (clamped - min) / (max - min)) * (H - PAD_T - PAD_B);
  };

  const events = log.filter((e) => e.kind === 'event' && e.t >= t0 && e.t <= t1);

  // Time axis ticks roughly every 5 minutes (min 1 min).
  const tickEvery = Math.max(60, Math.ceil(span / 6 / 60) * 60);
  const ticks: number[] = [];
  for (let t = Math.ceil(t0 / tickEvery) * tickEvery; t <= t1; t += tickEvery) ticks.push(t);

  return (
    <figure>
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            <span style={{ color: s.color }}>{s.label}</span>
          </span>
        ))}
        {events.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-3 w-px bg-slate-400" /> event
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[480px] rounded bg-slate-800/40 ring-1 ring-slate-700"
          role="img"
          aria-label="Vitals trends over the scenario"
        >
          {/* Event markers */}
          {events.map((e, i) => (
            <g key={i}>
              <line
                x1={x(e.t)}
                x2={x(e.t)}
                y1={PAD_T}
                y2={H - PAD_B}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <title>{`${fmt(e.t)} — ${e.label}`}</title>
            </g>
          ))}
          {/* Series */}
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth="1.8"
              strokeLinejoin="round"
              points={history.map((h) => `${x(h.t).toFixed(1)},${y(h[s.key], s.min, s.max).toFixed(1)}`).join(' ')}
            />
          ))}
          {/* Time axis */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={H - PAD_B} y2={H - PAD_B + 4} stroke="#64748b" strokeWidth="1" />
              <text x={x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">
                {fmt(t)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {events.length > 0 && (
        <figcaption className="mt-1 text-xs text-slate-500">
          Dashed lines: {events.map((e) => `${fmt(e.t)} ${e.label}`).join(' · ')}
        </figcaption>
      )}
    </figure>
  );
}
