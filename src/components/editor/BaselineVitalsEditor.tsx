'use client';

import { useEffect, useState } from 'react';
import type { CapnoShape, PvcFrequency, Rhythm, Vitals } from '@/lib/engine/types';
import {
  CAPNO_SHAPE_LABELS,
  NUMERIC_VITAL_KEYS,
  PVC_FREQUENCY_LABELS,
  RHYTHM_LABELS,
} from '@/lib/engine/types';
import { MIN_PULSE_PRESSURE, VITAL_META, maxDbpFor } from '@/lib/engine/vitals';

/**
 * Form editor for a scenario's starting vitals.
 *
 * Unlike EffectEditor (where blank = "unchanged"), every numeric here is
 * required — the patient always starts somewhere. Inputs hold local text
 * while focused so authors can clear-and-retype without values snapping;
 * blur restores the committed value if the field is left empty/invalid.
 * Optional display keys (capnoShape, pvcFrequency) follow the editor-wide
 * convention: choosing the default deletes the key from the document.
 */

function VitalNumberField({
  vitalKey,
  value,
  onCommit,
}: {
  vitalKey: (typeof NUMERIC_VITAL_KEYS)[number];
  value: number;
  onCommit: (value: number) => void;
}) {
  const meta = VITAL_META[vitalKey];
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <div>
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
        value={text}
        aria-label={`Baseline ${meta.label}`}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onCommit(n);
        }}
        onBlur={() => {
          setFocused(false);
          if (text === '' || !Number.isFinite(Number(text))) setText(String(value));
        }}
      />
    </div>
  );
}

export function BaselineVitalsEditor({
  vitals,
  onChange,
}: {
  vitals: Vitals;
  onChange: (vitals: Vitals) => void;
}) {
  const setRhythm = (rhythm: Rhythm) => {
    const next = { ...vitals, rhythm };
    // pvcFrequency only means something while the rhythm is 'pvc'.
    if (rhythm !== 'pvc') delete next.pvcFrequency;
    onChange(next);
  };

  const setOptional = (key: 'capnoShape' | 'pvcFrequency', raw: string) => {
    const next = { ...vitals };
    if (raw === '') delete next[key];
    else if (key === 'capnoShape') next.capnoShape = raw as CapnoShape;
    else next.pvcFrequency = raw as PvcFrequency;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="label">Starting numbers</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {NUMERIC_VITAL_KEYS.map((key) => (
            <VitalNumberField
              key={key}
              vitalKey={key}
              value={vitals[key]}
              onCommit={(v) => onChange({ ...vitals, [key]: v })}
            />
          ))}
        </div>
        <p
          className={`mt-1 text-xs ${
            vitals.dbp > maxDbpFor(vitals.sbp) ? 'text-red' : 'text-faint'
          }`}
        >
          DBP must be at least {MIN_PULSE_PRESSURE} below SBP (currently ≤ {maxDbpFor(vitals.sbp)}
          {' '}mmHg) — a narrower pulse pressure isn’t a plausible monitor reading.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Rhythm</span>
          <select
            className="input w-auto"
            value={vitals.rhythm}
            onChange={(e) => setRhythm(e.target.value as Rhythm)}
          >
            {(Object.keys(RHYTHM_LABELS) as Rhythm[]).map((r) => (
              <option key={r} value={r}>
                {RHYTHM_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {vitals.rhythm === 'pvc' && (
          <div>
            <span className="label">PVC frequency</span>
            <select
              className="input w-auto"
              // Explicit 'occasional' in hand-written JSON means the same as
              // absent — render both as the default option.
              value={vitals.pvcFrequency === 'occasional' ? '' : (vitals.pvcFrequency ?? '')}
              onChange={(e) => setOptional('pvcFrequency', e.target.value)}
            >
              <option value="">{PVC_FREQUENCY_LABELS.occasional} — default</option>
              {(Object.keys(PVC_FREQUENCY_LABELS) as PvcFrequency[])
                .filter((f) => f !== 'occasional')
                .map((f) => (
                  <option key={f} value={f}>
                    {PVC_FREQUENCY_LABELS[f]}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div>
          <span className="label">CO₂ waveform</span>
          <select
            className="input w-auto"
            // Explicit 'normal' means the same as absent — render as default.
            value={vitals.capnoShape === 'normal' ? '' : (vitals.capnoShape ?? '')}
            onChange={(e) => setOptional('capnoShape', e.target.value)}
          >
            <option value="">{CAPNO_SHAPE_LABELS.normal} — default</option>
            {(Object.keys(CAPNO_SHAPE_LABELS) as CapnoShape[])
              .filter((s) => s !== 'normal')
              .map((s) => (
                <option key={s} value={s}>
                  {CAPNO_SHAPE_LABELS[s]}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}
