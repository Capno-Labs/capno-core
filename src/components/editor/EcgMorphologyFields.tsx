'use client';

import type { EcgMorphology, QrsWidth, QtInterval, TWave } from '@/lib/engine/types';
import {
  QRS_WIDTH_LABELS,
  QT_INTERVAL_LABELS,
  ST_MM_MAX,
  ST_MM_MIN,
  T_WAVE_LABELS,
} from '@/lib/engine/types';

/**
 * ECG morphology fields, shared by the baseline-vitals editor and the effect
 * editor. They follow the editor-wide convention that an empty field is not
 * written to the document:
 *  - `baseline`: empty = normal (the default), so "normal" is never stored;
 *  - `effect`: empty = unchanged; "normal" is a real choice (return to normal).
 * When no field is set, the whole `ecg` key is removed.
 */
export function EcgMorphologyFields({
  value,
  onChange,
  mode,
}: {
  value: EcgMorphology | undefined;
  onChange: (next: EcgMorphology | undefined) => void;
  mode: 'baseline' | 'effect';
}) {
  const ecg = value ?? {};
  const baseline = mode === 'baseline';
  const blank = baseline ? 'Normal — default' : '— unchanged —';

  const commit = (next: EcgMorphology) => onChange(Object.keys(next).length > 0 ? next : undefined);

  const setSt = (field: 'stMm' | 'stV5Mm', raw: string) => {
    const next = { ...ecg };
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || (baseline && n === 0)) delete next[field];
    else next[field] = Math.min(ST_MM_MAX, Math.max(ST_MM_MIN, n));
    commit(next);
  };

  const stInput = (field: 'stMm' | 'stV5Mm', lead: string) => (
    <div>
      <span className="label">ST level, lead {lead} (mm)</span>
      <input
        className="input w-28"
        type="number"
        min={ST_MM_MIN}
        max={ST_MM_MAX}
        step={0.5}
        placeholder={baseline ? '0 = none' : 'unchanged'}
        title={
          field === 'stV5Mm'
            ? 'Negative = depression, positive = elevation. Drawn only when the monitor has a V5 lead.'
            : 'Negative = depression, positive = elevation. In an effect it follows the ramp duration.'
        }
        value={ecg[field] ?? ''}
        onChange={(e) => setSt(field, e.target.value)}
      />
    </div>
  );

  const setChoice = <K extends 'tWave' | 'qrs' | 'qt'>(key: K, raw: string) => {
    const next = { ...ecg };
    if (raw === '' || (baseline && raw === 'normal')) delete next[key];
    else next[key] = raw as EcgMorphology[K];
    commit(next);
  };

  const select = <K extends 'tWave' | 'qrs' | 'qt'>(
    key: K,
    label: string,
    labels: Record<string, string>,
  ) => (
    <div>
      <span className="label">{label}</span>
      <select
        className="input w-auto"
        // In a baseline, an explicit 'normal' means the same as absent.
        value={baseline && ecg[key] === 'normal' ? '' : (ecg[key] ?? '')}
        onChange={(e) => setChoice(key, e.target.value)}
      >
        <option value="">{blank}</option>
        {Object.keys(labels)
          .filter((k) => !baseline || k !== 'normal')
          .map((k) => (
            <option key={k} value={k}>
              {labels[k]}
            </option>
          ))}
      </select>
    </div>
  );

  return (
    <>
      {stInput('stMm', 'II')}
      {stInput('stV5Mm', 'V5')}
      {select('tWave', 'T wave', T_WAVE_LABELS satisfies Record<TWave, string>)}
      {select('qrs', 'QRS', QRS_WIDTH_LABELS satisfies Record<QrsWidth, string>)}
      {select('qt', 'QT', QT_INTERVAL_LABELS satisfies Record<QtInterval, string>)}
    </>
  );
}
