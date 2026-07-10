'use client';

import { useRef, useState } from 'react';
import type { CapnoShape, NumericVitals, Rhythm } from '@/lib/engine/types';
import { CAPNO_SHAPE_LABELS, RHYTHM_LABELS } from '@/lib/engine/types';
import { resolvePresetEffect, summarizeEffect, VITALS_PRESETS } from '@/lib/engine/presets';
import { VITAL_META, clampVital, roundVital } from '@/lib/engine/vitals';
import { useControllerStore } from '@/lib/store/controllerStore';

const SLIDER_KEYS: (keyof NumericVitals)[] = [
  'hr',
  'sbp',
  'dbp',
  'spo2',
  'etco2',
  'rr',
  'temp',
  'depth',
  'agentFi',
  'agentEt',
];

const TRANSITIONS = [
  { label: 'Instant', sec: 0 },
  { label: '20 s', sec: 20 },
  { label: '1 min', sec: 60 },
  { label: '3 min', sec: 180 },
];

function VitalSlider({
  vitalKey,
  current,
  overSec,
}: {
  vitalKey: keyof NumericVitals;
  current: number;
  overSec: number;
}) {
  const setVital = useControllerStore((s) => s.setVital);
  const meta = VITAL_META[vitalKey];
  const [draft, setDraft] = useState<number | null>(null);
  // Editing buffer for the typed input; null = not editing, mirror the live value.
  const [text, setText] = useState<string | null>(null);
  // Enter/Escape blur() before React re-renders, so onBlur would otherwise
  // re-commit (or commit a discarded) stale `text`.
  const skipBlurCommit = useRef(false);

  const shown = draft ?? current;
  const commit = () => {
    if (draft !== null && draft !== current) setVital(vitalKey, draft, overSec);
    setDraft(null);
  };
  const commitText = () => {
    const n = parseFloat(text ?? '');
    if (Number.isFinite(n)) setVital(vitalKey, roundVital(vitalKey, clampVital(vitalKey, n)), overSec);
    setText(null);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-300">{meta.label}</span>
      <input
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={shown}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') commit();
        }}
        className="h-2 flex-1 cursor-pointer accent-sky-500"
        aria-label={`${meta.label} target`}
      />
      <span className="flex w-24 shrink-0 items-center justify-end">
        <input
          type="number"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          inputMode="decimal"
          value={text ?? shown.toFixed(meta.decimals)}
          onFocus={(e) => {
            setText(shown.toFixed(meta.decimals));
            e.target.select();
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (skipBlurCommit.current) {
              skipBlurCommit.current = false;
              return;
            }
            commitText();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitText();
              skipBlurCommit.current = true;
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setText(null);
              skipBlurCommit.current = true;
              e.currentTarget.blur();
            }
          }}
          className={`w-16 rounded bg-slate-800 px-1 py-0.5 text-right font-mono text-sm tabular-nums outline-none ring-sky-500 focus:ring-1 ${
            draft !== null || text !== null ? 'text-sky-400' : 'text-slate-200'
          }`}
          aria-label={`${meta.label} typed target`}
        />
        <span className="ml-0.5 w-7 text-[10px] text-slate-500">{meta.unit}</span>
      </span>
    </div>
  );
}

/** Manual vital sign control: presets + sliders + rhythm selector + transition speed. */
export function VitalControls() {
  const engine = useControllerStore((s) => s.engine);
  const snapshot = useControllerStore((s) => s.snapshot);
  const setRhythm = useControllerStore((s) => s.setRhythm);
  const setCapnoShape = useControllerStore((s) => s.setCapnoShape);
  const cycleNibp = useControllerStore((s) => s.cycleNibp);
  const setArtLine = useControllerStore((s) => s.setArtLine);
  const applyPreset = useControllerStore((s) => s.applyPreset);
  const [overSec, setOverSec] = useState(20);
  const [flashPresetId, setFlashPresetId] = useState<string | null>(null);
  if (!engine || !snapshot) return null;

  const firePreset = (id: string) => {
    applyPreset(id);
    setFlashPresetId(id);
    // Fallback clear for reduced motion, where animationend never fires.
    setTimeout(() => setFlashPresetId((cur) => (cur === id ? null : cur)), 400);
  };

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Vitals</h2>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Transition speed">
          <span className="mr-1 text-[10px] uppercase text-slate-500">ramp</span>
          {TRANSITIONS.map((t) => (
            <button
              key={t.sec}
              onClick={() => setOverSec(t.sec)}
              className={`rounded px-2 py-1 text-xs font-semibold ${
                overSec === t.sec
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* One-tap physiologic bundles; values live in engine/presets.ts and
          are reviewed clinical content. Sliders stay live for fine-tuning. */}
      <div>
        <span className="label">Presets</span>
        <div className="flex flex-wrap gap-1">
          {VITALS_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => firePreset(p.id)}
              onAnimationEnd={() => setFlashPresetId((cur) => (cur === p.id ? null : cur))}
              title={`${p.description}\n${summarizeEffect(resolvePresetEffect(p, engine.scenario))}`}
              className={`rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 ring-1 ring-slate-700 transition hover:bg-slate-700 hover:text-slate-100 ${
                flashPresetId === p.id ? 'motion-safe:animate-event-fire' : ''
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {SLIDER_KEYS.map((k) => (
          <VitalSlider key={k} vitalKey={k} current={snapshot.vitals[k]} overSec={overSec} />
        ))}
      </div>

      {snapshot.nibp ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-slate-800/60 px-2 py-1.5">
          <span className="text-xs text-slate-400">
            Cuff last read{' '}
            <span className="font-mono text-slate-200">
              {snapshot.nibp.sbp}/{snapshot.nibp.dbp}
            </span>{' '}
            at {Math.floor(snapshot.nibp.atSec / 60)}:
            {String(snapshot.nibp.atSec % 60).padStart(2, '0')} — sliders set the true pressure;
            the monitor updates when the cuff cycles.
          </span>
          <span className="flex shrink-0 gap-1.5">
            <button className="btn-secondary !py-1 text-xs" onClick={cycleNibp}>
              Cycle NIBP now
            </button>
            <button
              className="btn-secondary !py-1 text-xs"
              onClick={() => setArtLine(true)}
              title="Switch to continuous arterial pressure with an ART waveform on the monitor"
            >
              Place A-line
            </button>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-md bg-slate-800/60 px-2 py-1.5">
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-vital-nibp">Arterial line in place</span> — the
            monitor shows beat-to-beat pressure and an ART waveform.
          </span>
          <button
            className="btn-secondary shrink-0 !py-1 text-xs"
            onClick={() => setArtLine(false)}
            title="Return to NIBP cuff mode (takes an immediate cuff reading)"
          >
            Remove A-line
          </button>
        </div>
      )}

      <div>
        <span className="label">Rhythm</span>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(RHYTHM_LABELS) as Rhythm[]).map((r) => (
            <button
              key={r}
              onClick={() => setRhythm(r)}
              className={`rounded px-2 py-1 text-xs font-semibold ${
                snapshot.vitals.rhythm === r
                  ? 'bg-vital-ecg/20 text-vital-ecg ring-1 ring-vital-ecg'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {RHYTHM_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">CO₂ waveform</span>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CAPNO_SHAPE_LABELS) as CapnoShape[]).map((s) => (
            <button
              key={s}
              onClick={() => setCapnoShape(s)}
              className={`rounded px-2 py-1 text-xs font-semibold ${
                (snapshot.vitals.capnoShape ?? 'normal') === s
                  ? 'bg-vital-etco2/20 text-vital-etco2 ring-1 ring-vital-etco2'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {CAPNO_SHAPE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
