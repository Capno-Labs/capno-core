import type { Scenario, VitalEffect } from './types';
import { NUMERIC_VITAL_KEYS } from './types';
import { roundVital, VITAL_META } from './vitals';

/**
 * Faculty vitals presets — one-tap physiologic bundles applied outside any
 * scenario event, for improvising common sim developments without slider
 * choreography. Applied via SimulationEngine.applyNamedEffect.
 *
 * CLINICAL CONTENT NOTICE: every numeric target below is copied from an
 * event in the reviewed bundled scenarios (source cited per preset), not
 * authored here. Any change to these values is a clinical-content change
 * and needs faculty review.
 *
 * Deliberately generic bundles only: whole crises (anaphylaxis, MH, LAST)
 * are scenarios with events, actions, and rubrics — not presets.
 */

export interface VitalsPreset {
  id: string;
  label: string;
  /** Shown to faculty before applying (tooltip/preview). */
  description: string;
  /** 'baseline' resolves to the loaded scenario's baseline at apply time. */
  effect: VitalEffect | 'baseline';
}

export const VITALS_PRESETS: VitalsPreset[] = [
  {
    id: 'normalize',
    label: 'Recovery / Normalize',
    description: 'Ramp everything back to the case baseline over 3 min.',
    effect: 'baseline',
  },
  {
    // Source: induction-hypotension › post-induction-hypotension
    id: 'hypotension',
    label: 'Hypotension',
    description: 'BP falls to 72/40 with HR 78 over 90 s.',
    effect: { vitals: { sbp: 72, dbp: 40, hr: 78 }, overSec: 90 },
  },
  {
    // Source: anaphylaxis › refractory-hypotension (SpO₂ 82) with the
    // tachycardic response from laryngospasm-lma › complete-laryngospasm.
    id: 'desaturation',
    label: 'Desaturation',
    description: 'SpO₂ drops to 82% with HR 112 over 2 min.',
    effect: { vitals: { spo2: 82, hr: 112 }, overSec: 120 },
  },
  {
    // Source: anaphylaxis › full-anaphylaxis (respiratory component).
    id: 'bronchospasm',
    label: 'Bronchospasm',
    description: 'Shark-fin capnograph, EtCO₂ 20, SpO₂ 88 over 2 min.',
    effect: { vitals: { etco2: 20, spo2: 88 }, capnoShape: 'bronchospasm', overSec: 120 },
  },
];

/** Ramp time for the baseline preset (matches the scenarios' resolution events). */
const NORMALIZE_OVER_SEC = 180;

/** Resolve a preset to a concrete effect against the loaded scenario. */
export function resolvePresetEffect(preset: VitalsPreset, scenario: Scenario): VitalEffect {
  if (preset.effect !== 'baseline') return preset.effect;
  const { rhythm, capnoShape, ...numeric } = scenario.baselineVitals;
  return { vitals: numeric, rhythm, capnoShape: capnoShape ?? 'normal', overSec: NORMALIZE_OVER_SEC };
}

/** Human-readable target summary, for preview tooltips. */
export function summarizeEffect(effect: VitalEffect): string {
  const parts: string[] = [];
  if (effect.vitals) {
    for (const key of NUMERIC_VITAL_KEYS) {
      const target = effect.vitals[key];
      if (target === undefined) continue;
      const meta = VITAL_META[key];
      parts.push(`${meta.label} → ${roundVital(key, target)}${meta.unit ? ' ' + meta.unit : ''}`);
    }
  }
  if (effect.rhythm) parts.push(`rhythm → ${effect.rhythm}`);
  if (effect.capnoShape) parts.push(`CO₂ waveform → ${effect.capnoShape}`);
  if (effect.overSec && effect.overSec > 0) parts.push(`over ${effect.overSec}s`);
  return parts.join(', ');
}
