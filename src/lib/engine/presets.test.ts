import { describe, expect, it } from 'vitest';
import { SimulationEngine } from './engine';
import { resolvePresetEffect, summarizeEffect, VITALS_PRESETS } from './presets';
import { clampVital } from './vitals';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import { NUMERIC_VITAL_KEYS, type NumericVitals } from './types';

const scenario = () => BUILT_IN_SCENARIOS[0];

describe('vitals presets', () => {
  it('reference only valid vital keys with in-range values', () => {
    for (const preset of VITALS_PRESETS) {
      const effect = resolvePresetEffect(preset, scenario());
      for (const [key, value] of Object.entries(effect.vitals ?? {})) {
        expect(NUMERIC_VITAL_KEYS).toContain(key as keyof NumericVitals);
        // In-range targets survive clamping unchanged.
        expect(clampVital(key as keyof NumericVitals, value)).toBe(value);
      }
    }
  });

  it('normalize resolves to the loaded scenario baseline', () => {
    const preset = VITALS_PRESETS.find((p) => p.id === 'normalize')!;
    const s = scenario();
    const effect = resolvePresetEffect(preset, s);
    expect(effect.vitals?.hr).toBe(s.baselineVitals.hr);
    expect(effect.vitals?.sbp).toBe(s.baselineVitals.sbp);
    expect(effect.rhythm).toBe(s.baselineVitals.rhythm);
    expect(effect.overSec).toBeGreaterThan(0);
  });

  it('summarizeEffect names every target', () => {
    const preset = VITALS_PRESETS.find((p) => p.id === 'bronchospasm')!;
    const summary = summarizeEffect(resolvePresetEffect(preset, scenario()));
    expect(summary).toContain('EtCO₂');
    expect(summary).toContain('bronchospasm');
    expect(summary).toContain('over 120s');
  });
});

describe('SimulationEngine.applyNamedEffect', () => {
  it('writes a single log entry and ramps toward the target', () => {
    const e = new SimulationEngine(scenario(), 'TEST');
    e.start();
    const logBefore = e.snapshot().log.length;
    const startSpo2 = e.getVitals().spo2;
    e.applyNamedEffect('Preset: Desaturation', { vitals: { spo2: startSpo2 - 20 }, overSec: 20 });
    expect(e.snapshot().log.length).toBe(logBefore + 1);
    const entry = e.snapshot().log.at(-1)!;
    expect(entry.kind).toBe('vital_change');
    expect(entry.label).toBe('Preset: Desaturation');
    expect(entry.detail).toBe('over 20s');
    e.tick(10);
    expect(e.getVitals().spo2).toBeCloseTo(startSpo2 - 10, 0);
    e.tick(20);
    expect(e.getVitals().spo2).toBe(startSpo2 - 20);
  });

  it('applies instantly when overSec is absent and honors afterSec delays', () => {
    const e = new SimulationEngine(scenario(), 'TEST');
    e.start();
    e.applyNamedEffect('instant', { vitals: { hr: 55 } });
    expect(e.getVitals().hr).toBe(55);
    e.applyNamedEffect('delayed', { vitals: { hr: 130 }, afterSec: 30 });
    expect(e.getVitals().hr).toBe(55); // not yet
    e.tick(31);
    expect(e.getVitals().hr).toBe(130);
  });

  it('works while idle (pre-start adjustments), like setVital', () => {
    const e = new SimulationEngine(scenario(), 'TEST');
    e.applyNamedEffect('pre-start', { vitals: { spo2: 91 } });
    expect(e.getVitals().spo2).toBe(91);
  });
});
