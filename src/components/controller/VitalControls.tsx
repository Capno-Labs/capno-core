'use client';

import { useRef, useState } from 'react';
import type {
  AnestheticAgent,
  CapnoShape,
  EcgLead,
  NumericVitals,
  PvcFrequency,
  QrsWidth,
  QtInterval,
  Rhythm,
  TWave,
} from '@/lib/engine/types';
import {
  AGENT_LABELS,
  AGENT_TAGS,
  CAPNO_SHAPE_LABELS,
  ecgMorphologyApplies,
  FICO2_MAX,
  rhythmPerfuses,
  formatStMm,
  NORMAL_ECG,
  PVC_FREQUENCY_LABELS,
  QRS_WIDTH_LABELS,
  QT_INTERVAL_LABELS,
  RHYTHM_LABELS,
  ST_FIELD,
  ST_MM_MAX,
  ST_MM_MIN,
  T_WAVE_LABELS,
  VENT_KEYS,
  VENT_META,
} from '@/lib/engine/types';
import { VITAL_META, clampVital, roundVital } from '@/lib/engine/vitals';
import { useControllerStore } from '@/lib/store/controllerStore';

// 'depth' is intentionally omitted: it drives no alarms, waveforms, or
// scoring, so a faculty slider for it is clutter. It stays a numeric vital
// (still shown in the SEV tile and settable by scenarios), like agentFi.
const SLIDER_KEYS: (keyof NumericVitals)[] = [
  'hr',
  'sbp',
  'dbp',
  'spo2',
  'etco2',
  'rr',
  'temp',
  'agentEt',
];

const TRANSITIONS = [
  { label: 'Instant', sec: 0 },
  { label: '3 s', sec: 3 },
  { label: '10 s', sec: 10 },
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
      <span className="w-16 shrink-0 text-xs font-semibold text-ink-2">{meta.label}</span>
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
        className="h-2 flex-1 cursor-pointer accent-brand"
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
          className={`w-16 rounded-ctl bg-panel-2 px-1 py-0.5 text-right font-mono text-sm tabular-nums outline-none ring-focus focus:ring-1 ${
            draft !== null || text !== null ? 'text-brand-strong' : 'text-ink'
          }`}
          aria-label={`${meta.label} typed target`}
        />
        <span className="ml-0.5 w-7 text-[10px] text-faint">{meta.unit}</span>
      </span>
    </div>
  );
}

/**
 * A number with −/+ steps and a box to type into. Commits on a step, on
 * Enter, or on leaving the box; an empty or invalid entry restores the value.
 */
function NumberStepper({
  label,
  value,
  unit,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commitText = () => {
    const n = Number(text);
    if (text !== null && text.trim() !== '' && Number.isFinite(n)) onCommit(clamp(n));
    setText(null);
  };
  return (
    <span className="flex items-center gap-1">
      <span className="w-12 text-xs font-semibold text-ink-2">{label}</span>
      <button
        className="btn-secondary btn-sm"
        onClick={() => onCommit(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Lower ${label} by ${step}`}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        value={text ?? String(value)}
        onFocus={(e) => {
          setText(String(value));
          e.target.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setText(null);
            e.currentTarget.blur();
          }
        }}
        className="w-16 rounded-ctl bg-panel-2 px-1 py-0.5 text-right font-mono text-sm tabular-nums text-ink outline-none ring-focus focus:ring-1"
        aria-label={`${label} target`}
      />
      <button
        className="btn-secondary btn-sm"
        onClick={() => onCommit(clamp(value + step))}
        disabled={value >= max}
        aria-label={`Raise ${label} by ${step}`}
      >
        +
      </button>
      <span className="w-10 text-[10px] text-faint">{unit}</span>
    </span>
  );
}

/** Manual vital sign control: sliders + rhythm selector + transition speed. */
export function VitalControls() {
  const engine = useControllerStore((s) => s.engine);
  const snapshot = useControllerStore((s) => s.snapshot);
  const setRhythm = useControllerStore((s) => s.setRhythm);
  const setCapnoShape = useControllerStore((s) => s.setCapnoShape);
  const setPvcFrequency = useControllerStore((s) => s.setPvcFrequency);
  const setEcg = useControllerStore((s) => s.setEcg);
  const setPulseless = useControllerStore((s) => s.setPulseless);
  const setFico2 = useControllerStore((s) => s.setFico2);
  const setVent = useControllerStore((s) => s.setVent);
  const setVentShown = useControllerStore((s) => s.setVentShown);
  const setAgent = useControllerStore((s) => s.setAgent);
  const cycleNibp = useControllerStore((s) => s.cycleNibp);
  const setArtLine = useControllerStore((s) => s.setArtLine);
  const setV5Lead = useControllerStore((s) => s.setV5Lead);
  const [overSec, setOverSec] = useState(3);
  if (!engine || !snapshot) return null;

  const ecg = { ...NORMAL_ECG, ...snapshot.vitals.ecg };
  // ST stepper for one lead: half-millimetre steps, following the selected ramp.
  const stStepper = (lead: EcgLead) => {
    const field = ST_FIELD[lead];
    const target = engine.getStTarget(lead);
    const step = (by: number) => {
      const next = Math.min(ST_MM_MAX, Math.max(ST_MM_MIN, Math.round((target + by) * 2) / 2));
      if (next !== target) setEcg({ [field]: next }, overSec);
    };
    return (
      <span className="flex items-center gap-1" key={lead}>
        <span className="w-10 text-xs font-semibold text-ink-2">ST {lead}</span>
        <button
          className="btn-secondary btn-sm"
          onClick={() => step(-0.5)}
          disabled={target <= ST_MM_MIN}
          aria-label={`Lower the ST segment in lead ${lead} by half a millimetre`}
        >
          −
        </button>
        <span
          className={`w-20 text-center font-mono text-sm tabular-nums ${target !== 0 ? 'text-vital-ecg' : 'text-ink'}`}
          title={`ST level in lead ${lead}, mm: negative is depression, positive is elevation. Changes over the selected ramp.`}
        >
          {formatStMm(target)} mm
        </span>
        <button
          className="btn-secondary btn-sm"
          onClick={() => step(0.5)}
          disabled={target >= ST_MM_MAX}
          aria-label={`Raise the ST segment in lead ${lead} by half a millimetre`}
        >
          +
        </button>
        {target !== 0 && (
          <button className="btn-ghost btn-sm" onClick={() => setEcg({ [field]: 0 }, overSec)}>
            baseline
          </button>
        )}
      </span>
    );
  };
  const fico2Target = engine.getFico2Target();
  const machineShown = engine.getVentShown();
  const agent = snapshot.gas?.agent ?? 'sevoflurane';
  const ecgChip = (active: boolean) =>
    `rounded-ctl px-2 py-1 text-xs font-semibold ${
      active ? 'bg-vital-ecg/20 text-vital-ecg ring-1 ring-vital-ecg' : 'bg-panel-2 text-muted hover:bg-panel-3'
    }`;

  return (
    <section className="card space-y-3" data-tour="vitals">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Vitals</h2>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Transition speed">
          <span className="mr-1 text-[10px] uppercase text-faint">ramp</span>
          {TRANSITIONS.map((t) => (
            <button
              key={t.sec}
              onClick={() => setOverSec(t.sec)}
              className={`rounded-ctl px-2 py-1 text-xs font-semibold ${
                overSec === t.sec
                  ? 'bg-brand text-on-brand'
                  : 'bg-panel-2 text-muted hover:bg-panel-3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
          <div className="space-y-1.5">
            {SLIDER_KEYS.map((k) => (
              <VitalSlider key={k} vitalKey={k} current={snapshot.vitals[k]} overSec={overSec} />
            ))}
          </div>

        {snapshot.nibp ? (
          <div className="flex items-center justify-between gap-2 rounded-ctl bg-panel-2 px-2 py-1.5">
            <span className="text-xs text-muted">
              Cuff last read{' '}
              <span className="font-mono text-ink">
                {snapshot.nibp.sbp}/{snapshot.nibp.dbp}
              </span>{' '}
              at {Math.floor(snapshot.nibp.atSec / 60)}:
              {String(snapshot.nibp.atSec % 60).padStart(2, '0')} — sliders set the true pressure;
              the monitor updates when the cuff cycles.
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button className="btn-secondary btn-sm" onClick={cycleNibp}>
                Cycle NIBP now
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setArtLine(true)}
                title="Switch to continuous arterial pressure with an ART waveform on the monitor"
              >
                Place A-line
              </button>
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-ctl bg-panel-2 px-2 py-1.5">
            <span className="text-xs text-muted">
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 rounded-ctl bg-panel-2 px-2 py-1.5">
            <span className="text-xs text-muted">
              {machineShown ? (
                <>
                  <span className="font-semibold text-ink-2">Machine readings on the monitor</span> —
                  airway pressure, tidal volume and inspired oxygen. They read what you set.
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink-2">No machine readings</span> — add airway
                  pressure, tidal volume and inspired oxygen tiles to the monitor.
                </>
              )}
            </span>
            <button
              className="btn-secondary btn-sm shrink-0"
              onClick={() => setVentShown(!machineShown)}
              title="Show or hide the anesthesia-machine tiles on every display"
            >
              {machineShown ? 'Hide machine readings' : 'Show machine readings'}
            </button>
          </div>
          {machineShown && (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {VENT_KEYS.map((key) => (
                <NumberStepper
                  key={key}
                  label={VENT_META[key].label}
                  unit={VENT_META[key].unit}
                  min={VENT_META[key].min}
                  max={VENT_META[key].max}
                  step={VENT_META[key].step}
                  value={engine.getVentTarget(key)}
                  onCommit={(value) => setVent({ [key]: value }, overSec)}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Volatile agent">
            <span className="w-12 text-xs font-semibold text-ink-2">Agent</span>
            {(Object.keys(AGENT_LABELS) as AnestheticAgent[]).map((a) => (
              <button
                key={a}
                onClick={() => setAgent(a)}
                className={ecgChip(agent === a)}
                title={AGENT_LABELS[a]}
              >
                {AGENT_TAGS[a]}
              </button>
            ))}
            {snapshot.gas && (
              <span className="ml-1 text-xs text-faint" title="End-tidal concentration as a multiple of this patient's age-adjusted MAC">
                MAC {snapshot.gas.mac.toFixed(1)} at Et {snapshot.vitals.agentEt.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-ctl bg-panel-2 px-2 py-1.5">
          <span className="text-xs text-muted">
            {snapshot.v5Lead ? (
              <>
                <span className="font-semibold text-vital-ecg">Leads II and V5</span> — the monitor
                shows both, each with its own ST level.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink-2">Lead II only</span> — add V5, the lead
                that shows most intraoperative ischemia.
              </>
            )}
          </span>
          <button
            className="btn-secondary btn-sm shrink-0"
            onClick={() => setV5Lead(!snapshot.v5Lead)}
            title="Show or hide a V5 ECG trace under lead II on every display"
          >
            {snapshot.v5Lead ? 'Remove V5 lead' : 'Add V5 lead'}
          </button>
        </div>

        <div>
          <span className="label">Rhythm</span>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(RHYTHM_LABELS) as Rhythm[]).map((r) => (
              <button
                key={r}
                onClick={() => setRhythm(r)}
                className={`rounded-ctl px-2 py-1 text-xs font-semibold ${
                  snapshot.vitals.rhythm === r
                    ? 'bg-vital-ecg/20 text-vital-ecg ring-1 ring-vital-ecg'
                    : 'bg-panel-2 text-muted hover:bg-panel-3'
                }`}
              >
                {RHYTHM_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Pulse</span>
          {rhythmPerfuses(snapshot.vitals.rhythm) ? (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Pulse">
              <button
                onClick={() => setPulseless(false)}
                className={ecgChip(!snapshot.vitals.pulseless)}
                aria-pressed={!snapshot.vitals.pulseless}
              >
                Present
              </button>
              <button
                onClick={() => setPulseless(true)}
                className={
                  snapshot.vitals.pulseless
                    ? 'rounded-ctl bg-red-soft px-2 py-1 text-xs font-semibold text-red ring-1 ring-red'
                    : 'rounded-ctl bg-panel-2 px-2 py-1 text-xs font-semibold text-muted hover:bg-panel-3'
                }
                aria-pressed={Boolean(snapshot.vitals.pulseless)}
                title="Keep this rhythm on the ECG but take the pulse away: PEA, or pulseless VT. The pleth and arterial trace go flat, SpO₂ loses its reading and the cuff fails. Set the pressures yourself."
              >
                Absent (PEA / pulseless VT)
              </button>
              {snapshot.vitals.pulseless && (
                <span className="text-xs text-faint">
                  stays absent when you change rhythm — switch back to Present for return of circulation
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-faint">
              None — this rhythm never has a pulse
              {snapshot.vitals.pulseless ? ' (and Pulse is set to Absent for the next rhythm)' : ''}.
            </span>
          )}
        </div>

        {snapshot.vitals.rhythm === 'pvc' && (
          <div>
            <span className="label">PVC frequency</span>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(PVC_FREQUENCY_LABELS) as PvcFrequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setPvcFrequency(f)}
                  className={`rounded-ctl px-2 py-1 text-xs font-semibold ${
                    (snapshot.vitals.pvcFrequency ?? 'occasional') === f
                      ? 'bg-vital-ecg/20 text-vital-ecg ring-1 ring-vital-ecg'
                      : 'bg-panel-2 text-muted hover:bg-panel-3'
                  }`}
                >
                  {PVC_FREQUENCY_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <span className="label">
            ECG complex
            {!ecgMorphologyApplies(snapshot.vitals.rhythm) && (
              <span className="ml-1 font-normal normal-case text-faint">
                — not drawn in this rhythm
              </span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {stStepper('II')}
            {snapshot.v5Lead && stStepper('V5')}
            <span className="flex items-center gap-1" role="group" aria-label="T wave">
              <span className="text-xs font-semibold text-ink-2">T</span>
              {(Object.keys(T_WAVE_LABELS) as TWave[]).map((t) => (
                <button key={t} onClick={() => setEcg({ tWave: t })} className={ecgChip(ecg.tWave === t)}>
                  {T_WAVE_LABELS[t]}
                </button>
              ))}
            </span>
            <span className="flex items-center gap-1" role="group" aria-label="QRS width">
              <span className="text-xs font-semibold text-ink-2">QRS</span>
              {(Object.keys(QRS_WIDTH_LABELS) as QrsWidth[]).map((q) => (
                <button key={q} onClick={() => setEcg({ qrs: q })} className={ecgChip(ecg.qrs === q)}>
                  {QRS_WIDTH_LABELS[q]}
                </button>
              ))}
            </span>
            <span className="flex items-center gap-1" role="group" aria-label="QT interval">
              <span className="text-xs font-semibold text-ink-2">QT</span>
              {(Object.keys(QT_INTERVAL_LABELS) as QtInterval[]).map((q) => (
                <button key={q} onClick={() => setEcg({ qt: q })} className={ecgChip(ecg.qt === q)}>
                  {QT_INTERVAL_LABELS[q]}
                </button>
              ))}
            </span>
          </div>
        </div>

        <div>
          <span className="label">CO₂ waveform</span>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(CAPNO_SHAPE_LABELS) as CapnoShape[]).map((s) => (
              <button
                key={s}
                onClick={() => setCapnoShape(s)}
                className={`rounded-ctl px-2 py-1 text-xs font-semibold ${
                  (snapshot.vitals.capnoShape ?? 'normal') === s
                    ? 'bg-vital-etco2/20 text-vital-etco2 ring-1 ring-vital-etco2'
                    : 'bg-panel-2 text-muted hover:bg-panel-3'
                }`}
              >
                {CAPNO_SHAPE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-xs font-semibold text-ink-2">Inspired CO₂</span>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setFico2(Math.max(0, fico2Target - 1), overSec)}
              disabled={fico2Target <= 0}
              aria-label="Lower the inspired CO2 by 1 mmHg"
            >
              −
            </button>
            <span
              className={`w-20 text-center font-mono text-sm tabular-nums ${fico2Target > 0 ? 'text-vital-etco2' : 'text-ink'}`}
              title="Inspired CO₂ — the capnogram's baseline. Above zero is rebreathing: exhausted absorbent or a stuck valve. Changes over the selected ramp."
            >
              {fico2Target} mmHg
            </span>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setFico2(Math.min(FICO2_MAX, fico2Target + 1), overSec)}
              disabled={fico2Target >= FICO2_MAX}
              aria-label="Raise the inspired CO2 by 1 mmHg"
            >
              +
            </button>
            {fico2Target > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => setFico2(0, overSec)}>
                zero
              </button>
            )}
            {(snapshot.vitals.capnoShape ?? 'normal') === 'esophageal' && (
              <span className="text-xs text-faint">
                esophageal: the EtCO₂ reading starts under 10 and is gone by the seventh breath, whatever the slider says
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
