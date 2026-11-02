import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateScenario } from '../engine/schema';
import { finalizeDraft } from './finalize';
import { parseText } from './parseText';
import { parseParsedDocument } from './schema';
import { detectProfile, extractDrafts } from './sections';
import type { DraftField, DraftFields, ImportDraft } from './types';

const FIXTURES = path.join(__dirname, 'fixtures');
const NOW = () => '2026-11-01T00:00:00.000Z';

function guideDoc() {
  const md = readFileSync(path.join(FIXTURES, 'sample-airway-guide.md'), 'utf8');
  return parseText(md, 'Instructor - Airway Planning Lab.docx');
}

function playbookDoc() {
  return parseParsedDocument(
    JSON.parse(readFileSync(path.join(FIXTURES, 'sample-airway-playbook.json'), 'utf8')),
  );
}

const VITAL_KEYS = [
  'hr', 'sbp', 'dbp', 'spo2', 'etco2', 'rr', 'temp', 'depth', 'agentEt', 'agentFi', 'rhythm',
] as const;

describe('parseText', () => {
  it('turns the Markdown transcription into headings, lists, paragraphs and one rubric table', () => {
    const doc = guideDoc();
    const kinds = doc.blocks.reduce<Record<string, number>>((acc, b) => {
      acc[b.kind] = (acc[b.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(kinds.table).toBe(1);
    expect(kinds.heading).toBeGreaterThan(10);
    const table = doc.blocks.find((b) => b.kind === 'table');
    expect(table?.tableCells?.[0]).toEqual(['Task', 'Performs', 'Performs with Assistance', 'Does Not Perform']);
    expect(table?.tableCells).toHaveLength(16); // header + 15 rows
    expect(doc.blocks.map((b) => b.id)).toEqual(doc.blocks.map((_, i) => `b${i + 1}`));
  });

  it('treats Word-pasted text (one paragraph per line) as separate paragraphs and ALL-CAPS lines as headings', () => {
    const lines = ['QUICK INSTRUCTOR CHECKLIST', ...Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of the paste.`)];
    const doc = parseText(lines.join('\n'));
    expect(doc.blocks[0]).toMatchObject({ kind: 'heading', level: 2 });
    expect(doc.blocks.filter((b) => b.kind === 'paragraph')).toHaveLength(12);
  });
});

describe('extractDrafts — instructor guide layout', () => {
  const doc = guideDoc();
  const { profile, drafts } = extractDrafts(doc, { sourceId: 'src', now: NOW });
  const [knee, abscess] = drafts;

  it('detects the profile and yields one draft per scenario', () => {
    expect(profile).toBe('cwru-guide');
    expect(drafts).toHaveLength(2);
    expect(knee.fields.title.value).toBe('Knee Arthroscopy');
    expect(abscess.fields.title.value).toBe('Submandibular Abscess Drainage');
    expect(knee.fields.id).toMatchObject({ status: 'proposed' });
  });

  it('routes rubric rows by their (N) marker into points-free expected actions', () => {
    expect(knee.fields.expectedActions).toHaveLength(8);
    expect(abscess.fields.expectedActions).toHaveLength(7);
    for (const a of [...knee.fields.expectedActions, ...abscess.fields.expectedActions]) {
      expect(a.status).toBe('extracted');
      expect(a.value?.points).toBe(0);
      expect(a.value?.critical).toBe(false);
      expect(a.provenance?.blockId).toBe(doc.blocks.find((b) => b.kind === 'table')?.id);
    }
    expect(knee.fields.expectedActions[0].value?.label).toBe(
      'Complete focused airway exam identifying the limited neck movement',
    );
    expect(knee.fields.expectedActions[0].value?.description).toContain('Performs with Assistance:');
    expect(knee.fields.rubric.map((c) => c.value?.label)).toEqual([
      'Airway Assessment',
      'Anesthetic Plan',
      'Routine Induction',
      'Intubation',
    ]);
    expect(knee.fields.rubric[3].value?.actionIds).toHaveLength(4);
  });

  it('keeps objectives, setup and debrief verbatim and shared across scenarios', () => {
    expect(knee.fields.learningObjectives.value).toEqual([
      'Completing a focused airway exam',
      'Agreeing a primary and backup plan with the attending and surgeon',
      'Checking that backup equipment is at the bedside before induction',
      'Switching techniques when the first approach fails',
      'Describing a safe emergence plan',
    ]);
    expect(abscess.fields.learningObjectives.value).toEqual(knee.fields.learningObjectives.value);
    expect(knee.fields.setup.value?.slice(0, 2)).toEqual([
      'Simulator running the baseline program',
      'Endotracheal tubes in two sizes, blades and handles',
    ]);
    // Scenario 2 adds its own set-up items after the shared ones.
    expect(abscess.fields.setup.value).toContain('Video laryngoscope');
    expect(abscess.fields.setup.value?.length).toBeGreaterThan(knee.fields.setup.value?.length ?? 0);
    expect(knee.fields.debrief.points.value).toHaveLength(2);
    expect(knee.fields.debrief.questions).toMatchObject({ status: 'extracted', value: [] });
  });

  it('turns phase headings into phases and instructor cue lines into effect-less events', () => {
    expect(knee.fields.phases.map((p) => p.value?.label)).toEqual(['Induction/Intubation']);
    expect(abscess.fields.phases.map((p) => p.value?.label)).toEqual([
      'Induction/Intubation',
      'Emergence/Extubation',
    ]);
    expect(knee.fields.events).toHaveLength(6);
    for (const e of knee.fields.events) {
      expect(e.status).toBe('unresolved');
      expect(e.value?.effects).toEqual([]);
      expect(e.value?.phaseHint).toBe('induction-intubation');
    }
    // Goals become the expected progression because a rubric covers the scenario.
    expect(knee.fields.expectedProgression.value).toHaveLength(6);
    expect(abscess.fields.expectedProgression.value?.[0]).toMatch(/^The students should choose an awake technique/);
  });

  it('only infers from explicit wording, and marks inferences as proposed', () => {
    expect(knee.fields.patient.sex).toMatchObject({ value: 'female', status: 'proposed' });
    expect(knee.fields.patient.airway.neckMobility).toMatchObject({ value: 'limited', status: 'proposed' });
    expect(abscess.fields.patient.sex).toMatchObject({ value: 'male', status: 'proposed' });
    expect(abscess.fields.patient.airway.neckMobility).toMatchObject({ value: null, status: 'unresolved' });
    expect(knee.fields.patient.plan.value).toMatch(/^A patient with long-standing rheumatoid arthritis/);
  });

  it('never fabricates vitals, demographics or timings (fabrication gate)', () => {
    for (const d of drafts) {
      for (const k of VITAL_KEYS) {
        expect(d.fields.baselineVitals[k]).toMatchObject({ value: null, status: 'unresolved' });
      }
      for (const k of ['name', 'age', 'weightKg', 'heightCm', 'asa'] as const) {
        expect(d.fields.patient[k]).toMatchObject({ value: null, status: 'unresolved' });
      }
      expect(d.fields.patient.airway.mallampati).toMatchObject({ value: null, status: 'unresolved' });
      expect(d.fields.estimatedMinutes).toMatchObject({ value: null, status: 'unresolved' });
      expect(d.fields.tags.difficulty).toMatchObject({ value: null, status: 'unresolved' });
    }
  });

  it('leaves unplaced blocks in the review rail rather than guessing', () => {
    const unmappedText = knee.unmappedBlockIds.map(
      (id) => doc.blocks.find((b) => b.id === id)?.text,
    );
    expect(unmappedText).toContain("See the week's assigned reading. Case summaries are in the shared folder.");
    expect(unmappedText).toContain('Scenario 1 rows are marked (1); Scenario 2 rows are marked (2)');
  });

  it('cites a block and quote for every extracted field', () => {
    const blockIds = new Set(doc.blocks.map((b) => b.id));
    const check = (f: DraftField<unknown>) => {
      if (f.status !== 'extracted' && f.status !== 'proposed') return;
      expect(f.provenance?.method).toBe('parser');
      expect(blockIds.has(f.provenance?.blockId ?? '')).toBe(true);
      expect(f.provenance?.quote?.length).toBeGreaterThan(0);
      const block = doc.blocks.find((b) => b.id === f.provenance?.blockId);
      expect(block?.text.startsWith(f.provenance?.quote ?? '') || block?.text.includes(f.provenance?.quote ?? '')).toBe(true);
    };
    const walk = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === 'object') {
        if ('status' in v && 'provenance' in v) return check(v as DraftField<unknown>);
        Object.values(v).forEach(walk);
      }
    };
    walk(knee.fields);
  });
});

describe('extractDrafts — instructor playbook (DOCX service shape)', () => {
  const doc = playbookDoc();
  const { profile, drafts } = extractDrafts(doc, { sourceId: 'job-1', now: NOW });
  const [knee] = drafts;

  it('detects the playbook profile and merges the at-a-glance and timeline spans of one scenario', () => {
    expect(detectProfile(doc)).toBe('cwru-playbook');
    expect(profile).toBe('cwru-playbook');
    expect(drafts).toHaveLength(1);
    expect(knee.fields.title.value).toBe('Knee Arthroscopy');
    expect(knee.fields.patient.plan.value).toMatch(/^Woman with long-standing rheumatoid arthritis/);
    expect(knee.fields.patient.sex).toMatchObject({ value: 'female', status: 'proposed' });
  });

  it('maps timeline rows to phases, SIM ACTION cells to effect-less events, and student actions to progression', () => {
    expect(knee.fields.phases.map((p) => p.value?.label)).toEqual([
      'Setup',
      'Airway exam & info gathering',
      'Induction & first laryngoscopy',
    ]);
    expect(knee.fields.phases[1].value?.description).toContain('Progress when: Airway exam done.');
    expect(knee.fields.events.map((e) => e.value?.label)).toEqual([
      'Baseline program running; normal baseline.',
      'Switch on the airway occluder; hold the mouth partly closed; no view.',
    ]);
    expect(knee.fields.events[1].value?.category).toBe('airway');
    expect(knee.fields.events.every((e) => e.status === 'unresolved')).toBe(true);
    expect(knee.fields.expectedActions).toHaveLength(2); // rubric rows
    expect(knee.fields.expectedProgression.value).toContain('Perform a focused airway exam');
    expect(knee.fields.learningObjectives.value).toEqual([
      'Perform a focused airway exam',
      "gather prior records and the surgeon's view",
      'keep the head neutral during laryngoscopy',
    ]);
    expect(knee.fields.setup.value).toEqual([
      'Simulator running the baseline program',
      'Bougie',
      'Video laryngoscope',
    ]);
  });

  it('still leaves vitals unresolved', () => {
    for (const k of VITAL_KEYS) {
      expect(knee.fields.baselineVitals[k]).toMatchObject({ value: null, status: 'unresolved' });
    }
  });
});

// ── finalize ─────────────────────────────────────────────────────────────────

function confirm<T>(field: DraftField<T>, value: T | null): DraftField<T> {
  return { ...field, value, status: 'confirmed', provenance: { method: 'faculty' } };
}

/** Resolve every outstanding field the way a reviewer would. */
function resolveAll(draft: ImportDraft): ImportDraft {
  const f: DraftFields = JSON.parse(JSON.stringify(draft.fields));
  const keep = <T,>(field: DraftField<T>) => (field.status === 'proposed' ? confirm(field, field.value) : field);
  f.id = keep(f.id);
  f.tags.topics = confirm(f.tags.topics, ['airway', 'difficult airway']);
  f.tags.difficulty = confirm(f.tags.difficulty, 'intermediate');
  f.tags.trainingLevels = confirm(f.tags.trainingLevels, ['saa']);
  f.patient.name = confirm(f.patient.name, 'Sim Patient');
  f.patient.age = confirm(f.patient.age, 45);
  f.patient.sex = keep(f.patient.sex);
  if (f.patient.sex.status === 'unresolved') f.patient.sex = confirm(f.patient.sex, 'female');
  f.patient.weightKg = confirm(f.patient.weightKg, 70);
  f.patient.heightCm = confirm(f.patient.heightCm, 170);
  f.patient.asa = confirm(f.patient.asa, 2);
  f.patient.allergies = confirm(f.patient.allergies, []);
  f.patient.medications = confirm(f.patient.medications, []);
  f.patient.pmh = confirm(f.patient.pmh, []);
  f.patient.airway.mallampati = confirm(f.patient.airway.mallampati, 2);
  for (const k of ['mouthOpeningCm', 'thyromentalCm', 'dentition', 'notes'] as const) {
    f.patient.airway[k] = confirm(f.patient.airway[k] as DraftField<never>, null);
  }
  f.patient.airway.neckMobility = keep(f.patient.airway.neckMobility);
  if (f.patient.airway.neckMobility.status === 'unresolved') {
    f.patient.airway.neckMobility = confirm(f.patient.airway.neckMobility, null);
  }
  const vitals = { hr: 72, sbp: 120, dbp: 78, spo2: 98, etco2: 36, rr: 12, temp: 36.6, depth: 0, agentEt: 0, agentFi: 0 };
  for (const [k, v] of Object.entries(vitals)) {
    const key = k as keyof typeof vitals;
    f.baselineVitals[key] = confirm(f.baselineVitals[key], v);
  }
  f.baselineVitals.rhythm = confirm(f.baselineVitals.rhythm, 'sinus');
  f.baselineVitals.capnoShape = confirm(f.baselineVitals.capnoShape, null);
  f.baselineVitals.pvcFrequency = confirm(f.baselineVitals.pvcFrequency, null);
  f.events = f.events.map((e) => confirm(e, e.value));
  f.correctManagement = confirm(f.correctManagement, []);
  f.commonErrors = confirm(f.commonErrors, []);
  f.estimatedMinutes = confirm(f.estimatedMinutes, 30);
  f.targetDurationSec = confirm(f.targetDurationSec, null);
  f.monitoring = confirm(f.monitoring, null);
  return { ...draft, fields: f };
}

describe('finalizeDraft', () => {
  const { drafts } = extractDrafts(guideDoc(), { sourceId: 'src', now: NOW });
  const [knee] = drafts;

  it('refuses a fresh extraction and lists every blocking path', () => {
    const result = finalizeDraft(knee);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unresolved).toEqual(
      expect.arrayContaining([
        'id',
        'tags.topics',
        'patient.name',
        'patient.sex',
        'baselineVitals.hr',
        'baselineVitals.rhythm',
        'events[0]',
        'estimatedMinutes',
      ]),
    );
    // Optional fields never block on their own.
    expect(result.unresolved).not.toContain('patient.plan');
    expect(result.unresolved).not.toContain('monitoring');
  });

  it('still refuses when a single required field is confirmed as null', () => {
    const resolved = resolveAll(knee);
    resolved.fields.patient.age = confirm(resolved.fields.patient.age, null);
    const result = finalizeDraft(resolved);
    expect(result).toEqual({ ok: false, unresolved: ['patient.age'] });
  });

  it('refuses a proposed value that faculty have not confirmed', () => {
    const resolved = resolveAll(knee);
    resolved.fields.patient.sex = { ...resolved.fields.patient.sex, status: 'proposed' };
    const result = finalizeDraft(resolved);
    expect(result).toEqual({ ok: false, unresolved: ['patient.sex'] });
  });

  it('produces a valid, imported-tagged scenario once everything is resolved', () => {
    const result = finalizeDraft(resolveAll(knee));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateScenario(result.scenario).ok).toBe(true);
    expect(result.scenario.tags.topics).toContain('imported');
    expect(result.scenario.tags.topics).not.toContain('ai-generated');
    expect(result.scenario.id).toBe('knee-arthroscopy');
    expect(result.scenario.expectedActions.every((a) => a.points === 0)).toBe(true);
    expect(result.scenario.rubric.flatMap((c) => c.actionIds).sort()).toEqual(
      result.scenario.expectedActions.map((a) => a.id).sort(),
    );
    expect(result.scenario.patient.plan).toMatch(/^A patient with long-standing rheumatoid arthritis/);
    expect(result.scenario.patient.airway.neckMobility).toBe('limited');
    expect(result.scenario).not.toHaveProperty('monitoring');
    expect(result.methodsUsed).toEqual(new Set(['parser', 'faculty']));
  });

  it('surfaces schema errors (e.g. a dangling rubric reference) as unresolved paths', () => {
    const resolved = resolveAll(knee);
    resolved.fields.rubric[0] = confirm(resolved.fields.rubric[0], {
      ...resolved.fields.rubric[0].value!,
      actionIds: ['does-not-exist'],
    });
    const result = finalizeDraft(resolved);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unresolved[0]).toMatch(/rubric\.0\.actionIds\.0: rubric references unknown action/);
  });

  it('tags scenarios that used LLM-proposed content as ai-generated', () => {
    const resolved = resolveAll(knee);
    resolved.fields.summary = {
      value: 'LLM summary',
      status: 'confirmed',
      provenance: { method: 'llm', model: 'test' },
    };
    const result = finalizeDraft(resolved);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenario.tags.topics).toContain('ai-generated');
  });
});
