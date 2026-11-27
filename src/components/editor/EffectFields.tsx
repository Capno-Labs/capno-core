'use client';

import { VITAL_NAMES } from './fieldLabels';
import { Disclosure } from '@/components/ui/Disclosure';
import { NumberField } from '@/components/ui/NumberField';
import { SelectField, optionsFrom } from '@/components/ui/SelectField';
import { TimeField } from '@/components/ui/TimeField';
import type { CapnoShape, NumericVitals, Rhythm, VitalEffect } from '@/lib/engine/types';
import { CAPNO_SHAPE_LABELS, FICO2_MAX, RHYTHM_LABELS } from '@/lib/engine/types';
import { VITAL_META } from '@/lib/engine/vitals';
import { countAdvancedEffectFields, describeEffect } from '@/lib/scenarios/progression';
import { ReorderButtons } from '@/components/ui/ReorderButtons';
import { EcgMorphologyFields } from './EcgMorphologyFields';
import { NmbFields } from './NmbFields';
import { VentFields } from './VentFields';

/**
 * One change an event makes to the patient. Shared by the case editor and
 * the run screen's live add-event form.
 *
 * Correctness-critical convention: an empty field means "no change" — the key
 * is absent from the effect, never written as 0. A systolic pressure of 0 is
 * a very different case from "leave it alone". Nothing is pre-filled;
 * faculty type every number.
 *
 * The vitals nearly every event moves come first; the rest sit in a closed
 * group that says how many of them are set.
 */

const COMMON: (keyof NumericVitals)[] = ['hr', 'sbp', 'dbp', 'spo2', 'etco2', 'rr'];
const MORE: (keyof NumericVitals)[] = ['temp', 'depth', 'agentEt', 'agentFi'];
const RHYTHM_OPTIONS = optionsFrom(RHYTHM_LABELS);
const CAPNO_OPTIONS = optionsFrom(CAPNO_SHAPE_LABELS);
const NO_CHANGE = 'No change';
/** Fields size to the column they sit in, not the window: this form lives in half a phase card. */
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3';

export function EffectFields({
  effect,
  title,
  onChange,
  onRemove,
}: {
  effect: VitalEffect;
  /** "Change 2" — only shown when the event has more than one. */
  title?: string;
  onChange: (effect: VitalEffect) => void;
  onRemove: () => void;
}) {
  const setVital = (key: keyof NumericVitals, value: number | undefined) => {
    const vitals = { ...(effect.vitals ?? {}) };
    if (value === undefined) delete vitals[key]; // empty = "no change", never 0
    else vitals[key] = value;
    const next = { ...effect };
    if (Object.keys(vitals).length > 0) next.vitals = vitals;
    else delete next.vitals;
    onChange(next);
  };

  /** Set an optional key, or delete it when the choice is "no change". */
  const set = <K extends keyof VitalEffect>(key: K, value: VitalEffect[K] | undefined) => {
    const next = { ...effect };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const vital = (key: keyof NumericVitals) => {
    const meta = VITAL_META[key];
    return (
      <NumberField
        key={key}
        label={VITAL_NAMES[key]}
        unit={meta.unit || undefined}
        value={effect.vitals?.[key]}
        min={meta.min}
        max={meta.max}
        step={meta.step}
        placeholder={NO_CHANGE}
        onChange={(v) => setVital(key, v)}
      />
    );
  };

  const summary = describeEffect(effect);
  const advanced = countAdvancedEffectFields(effect);

  return (
    <div className="space-y-3 rounded-ctl bg-panel/60 p-3 ring-1 ring-line">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm text-ink-2">
          {title && <span className="mr-2 font-semibold text-ink">{title}</span>}
          {summary || <span className="text-faint">Nothing set yet. Fill in only what this changes.</span>}
        </p>
        <ReorderButtons name={title ?? 'this change'} index={0} count={1} onRemove={onRemove} />
      </div>
      <div className={GRID}>
        {COMMON.map(vital)}
        <SelectField
          label="Rhythm"
          value={effect.rhythm}
          options={RHYTHM_OPTIONS}
          emptyLabel={NO_CHANGE}
          onChange={(rhythm) => set('rhythm', rhythm as Rhythm | undefined)}
        />
      </div>
      <div className={GRID}>
        <TimeField
          label="Takes"
          valueSec={effect.overSec}
          placeholder="Instant"
          hint="How long the vitals take to get there."
          onChange={(overSec) => set('overSec', overSec)}
        />
        <TimeField
          label="Starts after"
          valueSec={effect.afterSec}
          placeholder="At once"
          hint="A delay once the event fires."
          onChange={(afterSec) => set('afterSec', afterSec)}
        />
      </div>
      <Disclosure title="More changes" summary={advanced > 0 ? `${advanced} set` : 'None'}>
        <div className={GRID}>
          {MORE.map(vital)}
          <SelectField
            label="CO₂ waveform"
            value={effect.capnoShape}
            options={CAPNO_OPTIONS}
            emptyLabel={NO_CHANGE}
            onChange={(shape) => set('capnoShape', shape as CapnoShape | undefined)}
          />
          <NumberField
            label="Inspired CO₂"
            unit="mmHg"
            value={effect.fico2}
            min={0}
            max={FICO2_MAX}
            placeholder={NO_CHANGE}
            hint="Above zero is rebreathing."
            onChange={(fico2) => set('fico2', fico2)}
          />
          <SelectField
            label="Pulse"
            value={effect.pulseless === undefined ? undefined : effect.pulseless ? 'absent' : 'present'}
            options={[
              { value: 'absent', label: 'Absent (PEA / pulseless VT)' },
              { value: 'present', label: 'Present' },
            ]}
            emptyLabel={NO_CHANGE}
            onChange={(p) => set('pulseless', p === undefined ? undefined : p === 'absent')}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <VentFields
            mode="effect"
            vent={effect.vent}
            agent={effect.agent}
            onChange={({ vent, agent }) => {
              const next = { ...effect };
              if (vent) next.vent = vent;
              else delete next.vent;
              if (agent) next.agent = agent;
              else delete next.agent;
              onChange(next);
            }}
          />
          <NmbFields mode="effect" nmb={effect.nmb} onChange={(nmb) => set('nmb', nmb)} />
          <EcgMorphologyFields mode="effect" value={effect.ecg} onChange={(ecg) => set('ecg', ecg)} />
        </div>
      </Disclosure>
    </div>
  );
}
