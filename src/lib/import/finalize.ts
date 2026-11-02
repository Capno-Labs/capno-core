import { validateScenario, parseScenario } from '../engine/schema';
import type { Scenario } from '../engine/types';
import { AI_GENERATED_TAG } from '../llm/generator';
import type { DraftField, ImportDraft, ProvenanceMethod } from './types';
import { IMPORTED_TAG } from './types';

/**
 * `ImportDraft` → `Scenario`. Succeeds only when every required field has
 * been resolved by a verbatim extraction or by faculty; anything still
 * `unresolved` or merely `proposed` is reported by path and nothing is
 * filled in on the faculty member's behalf.
 */

export type FinalizeResult =
  | { ok: true; scenario: Scenario; methodsUsed: Set<ProvenanceMethod> }
  | { ok: false; unresolved: string[] };

/** Scenario fields the schema allows to be absent — may be confirmed as "not applicable". */
const OPTIONAL_PATHS = new Set([
  'patient.plan',
  'patient.airway.mouthOpeningCm',
  'patient.airway.thyromentalCm',
  'patient.airway.neckMobility',
  'patient.airway.dentition',
  'patient.airway.notes',
  'baselineVitals.capnoShape',
  'baselineVitals.pvcFrequency',
  'targetDurationSec',
  'monitoring',
]);

export function isOptionalPath(path: string): boolean {
  return OPTIONAL_PATHS.has(path);
}

function resolves(field: DraftField<unknown>): boolean {
  return field.status === 'extracted' || field.status === 'confirmed';
}

interface Walk {
  unresolved: string[];
  methods: Set<ProvenanceMethod>;
}

function take<T>(field: DraftField<T>, path: string, walk: Walk): T | undefined {
  if (!resolves(field)) {
    // An optional field the source never mentioned is simply omitted; a
    // proposed value always needs a human decision, optional or not.
    if (!(field.status === 'unresolved' && isOptionalPath(path))) walk.unresolved.push(path);
    return undefined;
  }
  if (field.value === null) {
    if (!isOptionalPath(path)) walk.unresolved.push(path);
    return undefined;
  }
  if (field.provenance) walk.methods.add(field.provenance.method);
  return field.value;
}

function takeList<T>(fields: DraftField<T>[], path: string, walk: Walk): T[] {
  const out: T[] = [];
  fields.forEach((f, i) => {
    const v = take(f, `${path}[${i}]`, walk);
    if (v !== undefined) out.push(v);
  });
  return out;
}

function compact<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

export function finalizeDraft(draft: ImportDraft): FinalizeResult {
  const f = draft.fields;
  const walk: Walk = { unresolved: [], methods: new Set() };

  const topics = take(f.tags.topics, 'tags.topics', walk) ?? [];
  const assembled = compact({
    id: take(f.id, 'id', walk),
    version: take(f.version, 'version', walk),
    title: take(f.title, 'title', walk),
    summary: take(f.summary, 'summary', walk),
    tags: compact({
      topics: [...topics, ...(topics.includes(IMPORTED_TAG) ? [] : [IMPORTED_TAG])],
      difficulty: take(f.tags.difficulty, 'tags.difficulty', walk),
      trainingLevels: take(f.tags.trainingLevels, 'tags.trainingLevels', walk),
    }),
    learningObjectives: take(f.learningObjectives, 'learningObjectives', walk),
    setup: take(f.setup, 'setup', walk),
    patient: compact({
      name: take(f.patient.name, 'patient.name', walk),
      age: take(f.patient.age, 'patient.age', walk),
      sex: take(f.patient.sex, 'patient.sex', walk),
      weightKg: take(f.patient.weightKg, 'patient.weightKg', walk),
      heightCm: take(f.patient.heightCm, 'patient.heightCm', walk),
      asa: take(f.patient.asa, 'patient.asa', walk),
      allergies: take(f.patient.allergies, 'patient.allergies', walk),
      medications: take(f.patient.medications, 'patient.medications', walk),
      pmh: take(f.patient.pmh, 'patient.pmh', walk),
      airway: compact({
        mallampati: take(f.patient.airway.mallampati, 'patient.airway.mallampati', walk),
        mouthOpeningCm: take(f.patient.airway.mouthOpeningCm, 'patient.airway.mouthOpeningCm', walk),
        thyromentalCm: take(f.patient.airway.thyromentalCm, 'patient.airway.thyromentalCm', walk),
        neckMobility: take(f.patient.airway.neckMobility, 'patient.airway.neckMobility', walk),
        dentition: take(f.patient.airway.dentition, 'patient.airway.dentition', walk),
        notes: take(f.patient.airway.notes, 'patient.airway.notes', walk),
      }),
      plan: take(f.patient.plan, 'patient.plan', walk),
    }),
    baselineVitals: compact({
      hr: take(f.baselineVitals.hr, 'baselineVitals.hr', walk),
      sbp: take(f.baselineVitals.sbp, 'baselineVitals.sbp', walk),
      dbp: take(f.baselineVitals.dbp, 'baselineVitals.dbp', walk),
      spo2: take(f.baselineVitals.spo2, 'baselineVitals.spo2', walk),
      etco2: take(f.baselineVitals.etco2, 'baselineVitals.etco2', walk),
      rr: take(f.baselineVitals.rr, 'baselineVitals.rr', walk),
      temp: take(f.baselineVitals.temp, 'baselineVitals.temp', walk),
      depth: take(f.baselineVitals.depth, 'baselineVitals.depth', walk),
      agentEt: take(f.baselineVitals.agentEt, 'baselineVitals.agentEt', walk),
      agentFi: take(f.baselineVitals.agentFi, 'baselineVitals.agentFi', walk),
      rhythm: take(f.baselineVitals.rhythm, 'baselineVitals.rhythm', walk),
      capnoShape: take(f.baselineVitals.capnoShape, 'baselineVitals.capnoShape', walk),
      pvcFrequency: take(f.baselineVitals.pvcFrequency, 'baselineVitals.pvcFrequency', walk),
    }),
    phases: takeList(f.phases, 'phases', walk),
    events: takeList(f.events, 'events', walk),
    expectedActions: takeList(f.expectedActions, 'expectedActions', walk),
    expectedProgression: take(f.expectedProgression, 'expectedProgression', walk),
    correctManagement: take(f.correctManagement, 'correctManagement', walk),
    commonErrors: take(f.commonErrors, 'commonErrors', walk),
    debrief: compact({
      points: take(f.debrief.points, 'debrief.points', walk),
      questions: take(f.debrief.questions, 'debrief.questions', walk),
    }),
    rubric: takeList(f.rubric, 'rubric', walk),
    estimatedMinutes: take(f.estimatedMinutes, 'estimatedMinutes', walk),
    targetDurationSec: take(f.targetDurationSec, 'targetDurationSec', walk),
    monitoring: take(f.monitoring, 'monitoring', walk),
  });

  if (walk.methods.has('llm')) {
    const t = assembled.tags as { topics: string[] };
    if (!t.topics.includes(AI_GENERATED_TAG)) t.topics.push(AI_GENERATED_TAG);
  }

  if (walk.unresolved.length > 0) return { ok: false, unresolved: walk.unresolved };

  const check = validateScenario(assembled);
  if (!check.ok) return { ok: false, unresolved: check.errors };
  return { ok: true, scenario: parseScenario(assembled), methodsUsed: walk.methods };
}

/** Paths of every field that still blocks finalization (for the review queue). */
export function unresolvedPaths(draft: ImportDraft): string[] {
  const result = finalizeDraft(draft);
  return result.ok ? [] : result.unresolved;
}
