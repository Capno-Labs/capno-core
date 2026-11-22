import { describe, expect, it } from 'vitest';
import { validateScenario } from './schema';
import { RHYTHM_LABELS } from './types';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import { QUICK_START_ID, QUICK_START_SCENARIO } from '../scenarios/quickStart';

import inductionHypotension from '@/scenarios/induction-hypotension.json';

describe('scenario schema', () => {
  it('validates all built-in scenarios (registry throws on load if invalid)', () => {
    expect(BUILT_IN_SCENARIOS).toHaveLength(12);
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
        'myocardial-ischemia',
        'hypoxemia',
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

  it('accepts an alarm profile and per-case limits, and rejects limits that contradict each other', () => {
    const doc = JSON.parse(JSON.stringify(inductionHypotension));
    doc.monitoring = { alarmProfile: 'pediatric' };
    expect(validateScenario(doc).ok).toBe(true);
    doc.monitoring = { alarmLimits: { hr: { warnHigh: 125 }, temp: { warnLow: null } } };
    expect(validateScenario(doc).ok).toBe(true);
    const bad = [
      { alarmProfile: 'geriatric' },
      { alarmLimits: { hr: { warnHigh: 400 } } }, // outside the vital's range
      { alarmLimits: { map: { warnLow: 60 } } }, // not a vital with limits
      { alarmLimits: { hr: { low: 60 } } }, // not a limit
      { alarmLimits: { hr: { warnLow: 120 } } }, // above the profile's high limit of 110
      { alarmLimits: { sbp: { critLow: 95 } } }, // critical low above the low warning of 90
      { alarmProfile: 'neonatal', alarmLimits: { hr: { critHigh: 150 } } }, // below the neonatal high of 200
    ];
    for (const monitoring of bad) {
      doc.monitoring = monitoring;
      expect(validateScenario(doc).ok, JSON.stringify(monitoring)).toBe(false);
    }
    doc.monitoring = { alarmLimits: { sbp: { critLow: 95 } } };
    expect(validateScenario(doc).errors.join(' ')).toContain('monitoring.alarmLimits.sbp');
    doc.monitoring = { alarmsOff: ['spo2', 'temp'] };
    expect(validateScenario(doc).ok).toBe(true);
    doc.monitoring = { alarmsOff: ['pplat'] }; // not a reading with limit alarms
    expect(validateScenario(doc).ok).toBe(false);

    // The machine's alarms take limits and switches like the vitals'.
    doc.monitoring = {
      alarmLimits: { paw: { critHigh: 50, critLow: 5 }, mv: { warnLow: 1, warnHigh: 15 }, fio2: { critLow: null } },
      alarmsOff: ['paw', 'mv', 'fio2'],
    };
    expect(validateScenario(doc).ok).toBe(true);
    for (const monitoring of [
      { alarmLimits: { paw: { critHigh: 90 } } }, // above the reading's range of 0–80
      { alarmLimits: { mv: { warnHigh: 31 } } }, // above 30 L/min
      { alarmLimits: { fio2: { critLow: 101 } } },
      { alarmLimits: { paw: { critLow: 45 } } }, // above the high limit of 40
      { alarmLimits: { mv: { warnLow: 12 } } }, // not below the high limit of 12
    ]) {
      doc.monitoring = monitoring;
      expect(validateScenario(doc).ok, JSON.stringify(monitoring)).toBe(false);
    }
  });

  it('accepts event actionIds that exist and rejects unknown ones', () => {
    const s = JSON.parse(JSON.stringify(inductionHypotension));
    s.events[0].actionIds = [s.expectedActions[0].id];
    expect(validateScenario(s).ok).toBe(true);
    s.events[0].actionIds = ['no-such-action'];
    const result = validateScenario(s);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('no-such-action');
  });

  it('accepts positive pacing targets and rejects non-positive ones', () => {
    const s = JSON.parse(JSON.stringify(inductionHypotension));
    s.targetDurationSec = 2700;
    s.phases[0].targetDurationSec = 300;
    expect(validateScenario(s).ok).toBe(true);
    s.targetDurationSec = 0;
    expect(validateScenario(s).ok).toBe(false);
    s.targetDurationSec = 2700;
    s.phases[0].targetDurationSec = -60;
    expect(validateScenario(s).ok).toBe(false);
  });

  it('rejects a baseline pulse pressure under 20 mmHg', () => {
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    bad.baselineVitals.sbp = 100;
    bad.baselineVitals.dbp = 85; // PP 15
    const result = validateScenario(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('pulse pressure');
  });

  it('rejects an event effect that sets both sbp and dbp closer than 20 mmHg', () => {
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    bad.events[0].effects[0].vitals = { sbp: 80, dbp: 65 }; // PP 15
    expect(validateScenario(bad).ok).toBe(false);
    // A single-sided effect can't be judged statically and stays valid —
    // the engine clamps it at runtime.
    bad.events[0].effects[0].vitals = { dbp: 65 };
    expect(validateScenario(bad).ok).toBe(true);
  });

  it('accepts 0/0 arrest vitals — the dbp ceiling floors at 0', () => {
    const arrest = JSON.parse(JSON.stringify(inductionHypotension));
    arrest.events[0].effects[0].vitals = { sbp: 0, dbp: 0 };
    expect(validateScenario(arrest).ok).toBe(true);
  });

  it('rejects duplicate event ids', () => {
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    bad.events.push({ ...bad.events[0] });
    const result = validateScenario(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('duplicate');
  });

  describe('ecg morphology', () => {
    const withBaselineEcg = (ecg: unknown) => {
      const doc = JSON.parse(JSON.stringify(inductionHypotension));
      doc.baselineVitals.ecg = ecg;
      return validateScenario(doc);
    };
    const withEffectEcg = (ecg: unknown) => {
      const doc = JSON.parse(JSON.stringify(inductionHypotension));
      doc.events[0].effects = [{ ecg, overSec: 60 }];
      return validateScenario(doc);
    };

    it('is optional, and every field inside it is optional', () => {
      expect(withBaselineEcg(undefined).ok).toBe(true);
      expect(withBaselineEcg({}).ok).toBe(true);
      expect(withBaselineEcg({ stMm: -1.5 }).ok).toBe(true);
      expect(withBaselineEcg({ stMm: 2, tWave: 'inverted', qrs: 'wide', qt: 'long' }).ok).toBe(true);
      expect(withEffectEcg({ stMm: -2 }).ok).toBe(true);
      expect(withEffectEcg({ tWave: 'peaked', qrs: 'wide' }).ok).toBe(true);
    });

    it('accepts a V5 ST level, and a V5 lead in the monitoring config', () => {
      expect(withBaselineEcg({ stV5Mm: -2 }).ok).toBe(true);
      expect(withEffectEcg({ stMm: -1, stV5Mm: -2.5 }).ok).toBe(true);
      expect(withEffectEcg({ stV5Mm: 7 }).ok).toBe(false);
      const doc = JSON.parse(JSON.stringify(inductionHypotension));
      doc.monitoring = { v5: true };
      expect(validateScenario(doc).ok).toBe(true);
      doc.monitoring = { v5: 'yes' };
      expect(validateScenario(doc).ok).toBe(false);
    });

    it('keeps the ST level within ±5 mm', () => {
      expect(withBaselineEcg({ stMm: 5 }).ok).toBe(true);
      expect(withBaselineEcg({ stMm: -5 }).ok).toBe(true);
      expect(withBaselineEcg({ stMm: 5.5 }).ok).toBe(false);
      expect(withEffectEcg({ stMm: -6 }).ok).toBe(false);
    });

    it('rejects unknown values and unknown fields', () => {
      expect(withBaselineEcg({ tWave: 'tall' }).ok).toBe(false);
      expect(withBaselineEcg({ qrs: 'narrow' }).ok).toBe(false);
      expect(withEffectEcg({ qt: 'short' }).ok).toBe(false);
      // A misspelt field must not pass silently as "no change".
      expect(withEffectEcg({ stmm: -2 }).ok).toBe(false);
      expect(withBaselineEcg({ stV6Mm: -2 }).ok).toBe(false);
    });
  });

  it('accepts every rhythm the engine names, and a pulseless flag on baseline and effects', () => {
    for (const rhythm of Object.keys(RHYTHM_LABELS)) {
      const doc = JSON.parse(JSON.stringify(inductionHypotension));
      doc.baselineVitals.rhythm = rhythm;
      doc.baselineVitals.pulseless = true;
      doc.events[0].effects = [{ rhythm, pulseless: false }];
      expect(validateScenario(doc).ok, rhythm).toBe(true);
    }
    const bad = JSON.parse(JSON.stringify(inductionHypotension));
    bad.baselineVitals.pulseless = 'yes';
    expect(validateScenario(bad).ok).toBe(false);
    const unknown = JSON.parse(JSON.stringify(inductionHypotension));
    unknown.baselineVitals.rhythm = 'wenckebach';
    expect(validateScenario(unknown).ok).toBe(false);
  });

  it('accepts the capnogram shapes and an inspired CO2 of 0–30 mmHg', () => {
    for (const shape of ['normal', 'bronchospasm', 'curare_cleft', 'cardiogenic', 'leak', 'esophageal']) {
      const doc = JSON.parse(JSON.stringify(inductionHypotension));
      doc.baselineVitals.capnoShape = shape;
      doc.baselineVitals.fico2 = 6;
      doc.events[0].effects = [{ capnoShape: shape, fico2: 0, overSec: 30 }];
      expect(validateScenario(doc).ok, shape).toBe(true);
    }
    for (const fico2 of [-1, 31]) {
      const bad = JSON.parse(JSON.stringify(inductionHypotension));
      bad.baselineVitals.fico2 = fico2;
      expect(validateScenario(bad).ok).toBe(false);
    }
    const unknown = JSON.parse(JSON.stringify(inductionHypotension));
    unknown.baselineVitals.capnoShape = 'rebreathing';
    expect(validateScenario(unknown).ok).toBe(false);
  });

  it('accepts a neuromuscular block on baseline and effects, within range', () => {
    const doc = JSON.parse(JSON.stringify(inductionHypotension));
    doc.baselineVitals.nmb = {};
    expect(validateScenario(doc).ok).toBe(true);
    doc.baselineVitals.nmb = { tofCount: 0, ptc: 2 };
    doc.events[0].effects[0].nmb = { tofCount: 4, tofRatio: 85 };
    expect(validateScenario(doc).ok).toBe(true);
    for (const bad of [{ tofCount: 5 }, { tofCount: 2.5 }, { tofRatio: 120 }, { ptc: 16 }, { ptc: -1 }, { t1: 50 }]) {
      const d = JSON.parse(JSON.stringify(doc));
      d.baselineVitals.nmb = bad;
      expect(validateScenario(d).ok, JSON.stringify(bad)).toBe(false);
      const e = JSON.parse(JSON.stringify(doc));
      e.events[0].effects[0].nmb = bad;
      expect(validateScenario(e).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('accepts machine readings and an agent on baseline and effects, within range', () => {
    const doc = JSON.parse(JSON.stringify(inductionHypotension));
    doc.baselineVitals.vent = {};
    doc.baselineVitals.agent = 'desflurane';
    doc.events[0].effects = [{ vent: { pip: 45, vt: 250 }, agent: 'isoflurane', overSec: 30 }];
    expect(validateScenario(doc).ok).toBe(true);
    doc.baselineVitals.vent = { fio2: 100, pip: 20, pplat: 16, peep: 5, vt: 480 };
    expect(validateScenario(doc).ok).toBe(true);

    for (const bad of [{ fio2: -1 }, { fio2: 101 }, { pip: 90 }, { peep: 30 }, { vt: 2000 }, { pressure: 20 }]) {
      const d = JSON.parse(JSON.stringify(inductionHypotension));
      d.baselineVitals.vent = bad;
      expect(validateScenario(d).ok, JSON.stringify(bad)).toBe(false);
    }
    const badAgent = JSON.parse(JSON.stringify(inductionHypotension));
    badAgent.baselineVitals.agent = 'halothane';
    expect(validateScenario(badAgent).ok).toBe(false);
  });

  it('accepts a desflurane-range end-tidal concentration', () => {
    const doc = JSON.parse(JSON.stringify(inductionHypotension));
    doc.baselineVitals.agent = 'desflurane';
    doc.baselineVitals.agentEt = 6.6;
    doc.baselineVitals.agentFi = 7;
    expect(validateScenario(doc).ok).toBe(true);
    doc.baselineVitals.agentEt = 19;
    expect(validateScenario(doc).ok).toBe(false);
  });
});

