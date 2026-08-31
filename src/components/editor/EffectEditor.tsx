'use client';

import type { CapnoShape, NumericVitals, Rhythm, VitalEffect } from '@/lib/engine/types';
import { CAPNO_SHAPE_LABELS, NUMERIC_VITAL_KEYS, RHYTHM_LABELS } from '@/lib/engine/types';
import { VITAL_META } from '@/lib/engine/vitals';

/**
 * Form editor for a single vital effect, shared by the case editor's event
 * detail surface and the run screen's live add-event form.
 *
 * Correctness-critical convention: an empty vital input means "unchanged"
 * (the key is absent from effect.vitals) — it is never written as 0. A 0
 * systolic pressure is a very different scenario than "leave it alone".
 * No clinical values are pre-filled anywhere; faculty type every number.
 */

export const fmtTime = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** One-line recap of what an effect does, so multi-effect events scan fast. */
export function effectSummary(effect: VitalEffect): string {
  const parts: string[] = [];
  for (const key of NUMERIC_VITAL_KEYS) {
    const v = effect.vitals?.[key];
    if (v !== undefined) parts.push(`${VITAL_META[key].label}→${v}`);
  }
  if (effect.rhythm) parts.push(`rhythm→${RHYTHM_LABELS[effect.rhythm]}`);
  if (effect.capnoShape) parts.push(`CO₂→${CAPNO_SHAPE_LABELS[effect.capnoShape]}`);
  if (parts.length === 0) return 'no changes yet';
  const timing: string[] = [];
  if (effect.afterSec) timing.push(`after ${effect.afterSec}s`);
  if (effect.overSec) timing.push(`over ${effect.overSec}s`);
  return parts.join(' · ') + (timing.length > 0 ? ` · ${timing.join(', ')}` : '');
}

export function EffectEditor({
  effect,
  onChange,
  onRemove,
}: {
  effect: VitalEffect;
  onChange: (effect: VitalEffect) => void;
  onRemove: () => void;
}) {
  const setVital = (key: keyof NumericVitals, raw: string) => {
    const vitals = { ...(effect.vitals ?? {}) };
    if (raw === '') {
      delete vitals[key]; // empty = "unchanged", never 0
    } else {
      vitals[key] = Number(raw);
    }
    onChange(
      Object.keys(vitals).length > 0
        ? { ...effect, vitals }
        : (({ vitals: _v, ...rest }) => rest)(effect),
    );
  };

  const setNum = (field: 'afterSec' | 'overSec', raw: string) => {
    const next = { ...effect };
    if (raw === '') delete next[field];
    else next[field] = Math.max(0, Number(raw));
    onChange(next);
  };

  return (
    <div className="space-y-2 rounded bg-panel/60 p-2 ring-1 ring-line">
      <p className="font-mono text-[11px] text-muted">{effectSummary(effect)}</p>
      <p className="text-xs text-faint">
        When the event fires: wait the delay, then ramp the vitals below to their targets over the
        ramp duration (blank vital = unchanged).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Delay before start (s)</span>
          <input
            className="input w-24"
            type="number"
            min={0}
            placeholder="0"
            value={effect.afterSec ?? ''}
            onChange={(e) => setNum('afterSec', e.target.value)}
          />
        </div>
        <div>
          <span className="label">Ramp duration (s)</span>
          <input
            className="input w-24"
            type="number"
            min={0}
            placeholder="0 = instant"
            value={effect.overSec ?? ''}
            onChange={(e) => setNum('overSec', e.target.value)}
          />
        </div>
        <div>
          <span className="label">Rhythm</span>
          <select
            className="input w-auto"
            value={effect.rhythm ?? ''}
            onChange={(e) => {
              const next = { ...effect };
              if (e.target.value === '') delete next.rhythm;
              else next.rhythm = e.target.value as Rhythm;
              onChange(next);
            }}
          >
            <option value="">— unchanged —</option>
            {(Object.keys(RHYTHM_LABELS) as Rhythm[]).map((r) => (
              <option key={r} value={r}>
                {RHYTHM_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">CO₂ waveform</span>
          <select
            className="input w-auto"
            value={effect.capnoShape ?? ''}
            onChange={(e) => {
              const next = { ...effect };
              if (e.target.value === '') delete next.capnoShape;
              else next.capnoShape = e.target.value as CapnoShape;
              onChange(next);
            }}
          >
            <option value="">— unchanged —</option>
            {(Object.keys(CAPNO_SHAPE_LABELS) as CapnoShape[]).map((s) => (
              <option key={s} value={s}>
                {CAPNO_SHAPE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn-ghost ml-auto !px-2 !py-1 text-red"
          onClick={onRemove}
          aria-label="remove effect"
        >
          ✕
        </button>
      </div>
      <div>
        <span className="label">Vital targets (blank = unchanged)</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {NUMERIC_VITAL_KEYS.map((key) => {
            const meta = VITAL_META[key];
            return (
              <div key={key}>
                <span className="block text-[10px] uppercase tracking-wider text-faint">
                  {meta.label}
                  {meta.unit ? ` (${meta.unit})` : ''}
                </span>
                <input
                  className="input !px-2 !py-1 text-sm"
                  type="number"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={effect.vitals?.[key] ?? ''}
                  onChange={(e) => setVital(key, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
