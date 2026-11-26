'use client';

import { Disclosure } from '@/components/ui/Disclosure';
import { NumberField } from '@/components/ui/NumberField';
import { SelectField, optionsFrom } from '@/components/ui/SelectField';
import type { CapnoShape, NumericVitals, PvcFrequency, Rhythm, Vitals } from '@/lib/engine/types';
import { CAPNO_SHAPE_LABELS, FICO2_MAX, PVC_FREQUENCY_LABELS, RHYTHM_LABELS } from '@/lib/engine/types';
import { DEFAULT_VITALS, MIN_PULSE_PRESSURE, VITAL_META, maxDbpFor } from '@/lib/engine/vitals';
import { EcgMorphologyFields } from './EcgMorphologyFields';
import { NmbFields } from './NmbFields';
import { VentFields } from './VentFields';

/**
 * Form editor for a scenario's starting vitals.
 *
 * Unlike EffectFields (where blank = "no change"), every numeric here is
 * required — the patient always starts somewhere. The numbers every case sets
 * come first; what most cases leave alone sits in closed groups, each saying
 * whether anything inside it is set. Optional display keys (capnoShape,
 * pvcFrequency, ecg, …) follow the editor-wide convention: choosing the
 * default deletes the key from the document.
 */

/** Long names for the starting numbers — the monitor's abbreviations are for the monitor. */
const VITAL_NAMES: Record<keyof NumericVitals, string> = {
  hr: 'Heart rate',
  sbp: 'Systolic BP',
  dbp: 'Diastolic BP',
  spo2: 'SpO₂',
  etco2: 'EtCO₂',
  rr: 'Respiratory rate',
  temp: 'Temperature',
  depth: 'Depth of anesthesia',
  agentEt: 'End-tidal agent',
  agentFi: 'Inspired agent',
};

const COMMON: (keyof NumericVitals)[] = ['hr', 'sbp', 'dbp', 'spo2', 'etco2', 'rr', 'temp'];

const RHYTHM_OPTIONS = optionsFrom(RHYTHM_LABELS);
const PVC_OPTIONS = optionsFrom(PVC_FREQUENCY_LABELS).filter((o) => o.value !== 'occasional');
const CAPNO_OPTIONS = optionsFrom(CAPNO_SHAPE_LABELS).filter((o) => o.value !== 'normal');

export function BaselineVitalsEditor({
  vitals,
  onChange,
}: {
  vitals: Vitals;
  onChange: (vitals: Vitals) => void;
}) {
  const number = (key: keyof NumericVitals, hint?: string) => {
    const meta = VITAL_META[key];
    return (
      <NumberField
        key={key}
        label={VITAL_NAMES[key]}
        unit={meta.unit || undefined}
        value={vitals[key]}
        min={meta.min}
        max={meta.max}
        step={meta.step}
        hint={hint}
        required
        onChange={(v) => v !== undefined && onChange({ ...vitals, [key]: v })}
      />
    );
  };

  const setRhythm = (rhythm: Rhythm) => {
    const next = { ...vitals, rhythm };
    // pvcFrequency only means something while the rhythm is 'pvc'.
    if (rhythm !== 'pvc') delete next.pvcFrequency;
    onChange(next);
  };

  /** Set an optional key, or delete it when the choice is the default. */
  const setOptional = <K extends 'capnoShape' | 'pvcFrequency' | 'fico2' | 'pulseless'>(
    key: K,
    value: Vitals[K] | undefined,
  ) => {
    const next = { ...vitals };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const pulsePressureTooNarrow = vitals.dbp > maxDbpFor(vitals.sbp);
  const depthSet =
    vitals.depth !== DEFAULT_VITALS.depth || vitals.agentEt > 0 || vitals.agentFi > 0 || vitals.agent !== undefined;
  const co2Set =
    (vitals.capnoShape !== undefined && vitals.capnoShape !== 'normal') ||
    vitals.fico2 !== undefined ||
    vitals.pulseless === true;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COMMON.map((key) => number(key))}
        <SelectField
          label="Rhythm"
          value={vitals.rhythm}
          options={RHYTHM_OPTIONS}
          onChange={(r) => r && setRhythm(r)}
        />
        {vitals.rhythm === 'pvc' && (
          <SelectField
            label="PVC frequency"
            // Explicit 'occasional' in hand-written JSON means the same as absent.
            value={vitals.pvcFrequency === 'occasional' ? undefined : vitals.pvcFrequency}
            options={PVC_OPTIONS}
            emptyLabel={`${PVC_FREQUENCY_LABELS.occasional} (default)`}
            onChange={(f) => setOptional('pvcFrequency', f as PvcFrequency | undefined)}
          />
        )}
      </div>
      <p className={`text-xs ${pulsePressureTooNarrow ? 'font-medium text-red' : 'text-faint'}`}>
        Diastolic must be at least {MIN_PULSE_PRESSURE} mmHg below systolic
        {pulsePressureTooNarrow ? ` — ${maxDbpFor(vitals.sbp)} or less for a systolic of ${vitals.sbp}.` : '.'}
      </p>
      <div>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            const next = { ...vitals };
            for (const key of COMMON) next[key] = DEFAULT_VITALS[key];
            next.rhythm = DEFAULT_VITALS.rhythm;
            delete next.pvcFrequency;
            onChange(next);
          }}
        >
          Fill with the studio’s default adult values
        </button>
        <p className="mt-1 text-xs text-faint">
          Sets the eight fields above to HR {DEFAULT_VITALS.hr}, BP {DEFAULT_VITALS.sbp}/{DEFAULT_VITALS.dbp}, SpO₂{' '}
          {DEFAULT_VITALS.spo2}, EtCO₂ {DEFAULT_VITALS.etco2}, RR {DEFAULT_VITALS.rr}, {DEFAULT_VITALS.temp} °C,
          sinus rhythm. A starting point to edit, not a recommendation for this patient.
        </p>
      </div>

      <Disclosure title="Depth and anesthetic agent" summary={depthSet ? 'Set' : 'Default, no agent'}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {number('depth', 'An index like processed EEG: 40–60 is surgical anesthesia, above 80 is awake.')}
          {number('agentEt')}
          {number('agentFi')}
        </div>
      </Disclosure>

      <Disclosure title="CO₂ waveform and pulse" summary={co2Set ? 'Set' : 'Normal'}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="CO₂ waveform"
            // Explicit 'normal' means the same as absent.
            value={vitals.capnoShape === 'normal' ? undefined : vitals.capnoShape}
            options={CAPNO_OPTIONS}
            emptyLabel={`${CAPNO_SHAPE_LABELS.normal} (default)`}
            onChange={(shape) => setOptional('capnoShape', shape as CapnoShape | undefined)}
          />
          <NumberField
            label="Inspired CO₂"
            unit="mmHg"
            value={vitals.fico2}
            min={0}
            max={FICO2_MAX}
            placeholder="None"
            hint="The capnogram’s baseline. Above zero is rebreathing."
            onChange={(n) => setOptional('fico2', n === undefined || n <= 0 ? undefined : n)}
          />
          <SelectField
            label="Pulse"
            value={vitals.pulseless ? 'absent' : undefined}
            options={[{ value: 'absent', label: 'Absent (PEA / pulseless VT)' }]}
            emptyLabel="Present (default)"
            onChange={(p) => setOptional('pulseless', p === 'absent' ? true : undefined)}
          />
        </div>
      </Disclosure>

      <Disclosure
        title="Anesthesia machine"
        summary={vitals.vent ? 'Readings shown' : vitals.agent ? 'Agent set' : 'Not shown'}
      >
        <div className="flex flex-wrap items-end gap-3">
          <VentFields
            mode="baseline"
            vent={vitals.vent}
            agent={vitals.agent}
            onChange={({ vent, agent }) => {
              const next = { ...vitals };
              if (vent) next.vent = vent;
              else delete next.vent;
              if (agent) next.agent = agent;
              else delete next.agent;
              onChange(next);
            }}
          />
        </div>
      </Disclosure>

      <Disclosure title="Twitch monitor" summary={vitals.nmb ? 'Attached' : 'Not attached'}>
        <div className="flex flex-wrap items-end gap-3">
          <NmbFields
            mode="baseline"
            nmb={vitals.nmb}
            onChange={(nmb) => {
              const next = { ...vitals };
              if (nmb) next.nmb = nmb;
              else delete next.nmb;
              onChange(next);
            }}
          />
        </div>
      </Disclosure>

      <Disclosure title="ECG detail" summary={vitals.ecg ? 'Set' : 'Normal'}>
        <div className="flex flex-wrap items-end gap-3">
          <EcgMorphologyFields
            mode="baseline"
            value={vitals.ecg}
            onChange={(ecg) => {
              const next = { ...vitals };
              if (ecg) next.ecg = ecg;
              else delete next.ecg;
              onChange(next);
            }}
          />
        </div>
      </Disclosure>
    </div>
  );
}
