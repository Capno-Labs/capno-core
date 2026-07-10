import { describe, expect, it } from 'vitest';
import { validateScenario } from './schema';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import { QUICK_START_ID, QUICK_START_SCENARIO } from '../scenarios/quickStart';

import inductionHypotension from '@/scenarios/induction-hypotension.json';

describe('scenario schema', () => {
  it('validates all built-in scenarios (registry throws on load if invalid)', () => {
    expect(BUILT_IN_SCENARIOS).toHaveLength(10);
    const ids = BUILT_IN_SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'induction-hypotension',
        'laryngospasm-lma',
        'anaphylaxis',
        'malignant-hyperthermia',
        'last-nerve-block',
        'bradycardia-asystole',
        'intraop-bronchospasm',
        'difficult-airway-cico',
        'postpartum-hemorrhage',
        'venous-air-embolism',
      ]),
    );
  });

  it('every built-in scenario has required teaching content', () => {
    for (const s of BUILT_IN_SCENARIOS) {
      expect(s.learningObjectives.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.events.length, s.id).toBeGreaterThanOrEqual(5);
      expect(s.expectedActions.length, s.id).toBeGreaterThanOrEqual(8);
      expect(s.debrief.questions.length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.rubric.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.expectedActions.some((a) => a.critical), s.id).toBe(true);
    }
  });

  it('quick-start is a valid freeform scenario kept out of the built-in library', () => {
    // Parsed at module load, so importing it is already a validity check.
    expect(QUICK_START_SCENARIO.id).toBe(QUICK_START_ID);
    expect(QUICK_START_SCENARIO.events).toEqual([]);
    // Deliberate: it has no teaching content, so it must not join
    // BUILT_IN_SCENARIOS (whose entries are held to the minimums above).
    expect(BUILT_IN_SCENARIOS.map((s) => s.id)).not.toContain(QUICK_START_ID);
  });

  it('rejects a rubric referencing an unknown action', () => {
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    bad.rubric[0].actionIds.push('does-not-exist');
    const result = validateScenario(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('does-not-exist');
  });

  it('rejects out-of-range vitals', () => {
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    bad.baselineVitals.spo2 = 140;
    expect(validateScenario(bad).ok).toBe(false);
  });

  it('rejects missing required fields', () => {
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    delete bad.patient;
    expect(validateScenario(bad).ok).toBe(false);
  });

  it('accepts an optional monitoring config and rejects bad intervals', () => {
    const withMonitoring = JSON.parse(JSON.stringify(inductionHypotension));
    withMonitoring.monitoring = { artLine: true };
    expect(validateScenario(withMonitoring).ok).toBe(true);
    withMonitoring.monitoring = { nibpIntervalSec: 120 };
    expect(validateScenario(withMonitoring).ok).toBe(true);
    withMonitoring.monitoring = { nibpIntervalSec: 2 }; // implausibly fast cuff
    expect(validateScenario(withMonitoring).ok).toBe(false);
  });

  it('rejects duplicate event ids', () => {
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    bad.events.push({ ...bad.events[0] });
    const result = validateScenario(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('duplicate');
  });
});
