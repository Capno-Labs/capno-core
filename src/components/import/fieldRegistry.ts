import type { SectionId } from '@/components/editor/sections';
import type { DraftField, DraftFields } from '@/lib/import';

/**
 * The review screen's view of an `ImportDraft`: every scalar/list field
 * with its label, editor kind and owning editor section (so the review
 * groups fields the way the case editor does), plus the four item lists.
 * Enum options mirror `src/lib/engine/schema.ts`; keep them in step when
 * the scenario schema changes (CLAUDE.md invariant 2).
 */

export type FieldKind = 'string' | 'number' | 'enum' | 'stringList' | 'json';

export interface FieldSpec {
  path: string;
  label: string;
  section: SectionId;
  kind: FieldKind;
  options?: readonly (string | number)[];
  optional?: boolean;
  hint?: string;
}

export const RHYTHMS = [
  'sinus', 'sinus_brady', 'sinus_tach', 'pvc', 'pac', 'afib', 'svt', 'vtach', 'vfib', 'pea', 'asystole',
] as const;
export const TRAINING_LEVELS = [
  'medical_student', 'srna', 'saa', 'resident_junior', 'resident_senior', 'crna', 'caa', 'attending',
] as const;

export const FIELD_SPECS: FieldSpec[] = [
  { path: 'title', label: 'Title', section: 'overview', kind: 'string' },
  { path: 'id', label: 'Scenario id', section: 'overview', kind: 'string', hint: 'lowercase, a-z 0-9 - _' },
  { path: 'summary', label: 'Summary', section: 'overview', kind: 'string' },
  { path: 'tags.topics', label: 'Topics', section: 'overview', kind: 'stringList', hint: 'First topic is the curriculum domain (airway, respiratory, cardiac, …)' },
  { path: 'tags.difficulty', label: 'Difficulty', section: 'overview', kind: 'enum', options: ['beginner', 'intermediate', 'advanced'] },
  { path: 'tags.trainingLevels', label: 'Training levels', section: 'overview', kind: 'stringList', hint: TRAINING_LEVELS.join(', ') },
  { path: 'estimatedMinutes', label: 'Estimated minutes', section: 'overview', kind: 'number' },
  { path: 'targetDurationSec', label: 'Lab slot (seconds)', section: 'overview', kind: 'number', optional: true },
  { path: 'version', label: 'Version', section: 'overview', kind: 'string' },

  { path: 'patient.name', label: 'Patient name', section: 'patient', kind: 'string' },
  { path: 'patient.age', label: 'Age', section: 'patient', kind: 'number' },
  { path: 'patient.sex', label: 'Sex', section: 'patient', kind: 'enum', options: ['male', 'female'] },
  { path: 'patient.weightKg', label: 'Weight (kg)', section: 'patient', kind: 'number' },
  { path: 'patient.heightCm', label: 'Height (cm)', section: 'patient', kind: 'number' },
  { path: 'patient.asa', label: 'ASA class', section: 'patient', kind: 'enum', options: [1, 2, 3, 4, 5, 6] },
  { path: 'patient.allergies', label: 'Allergies', section: 'patient', kind: 'stringList' },
  { path: 'patient.medications', label: 'Medications', section: 'patient', kind: 'stringList' },
  { path: 'patient.pmh', label: 'Past medical history', section: 'patient', kind: 'stringList' },
  { path: 'patient.airway.mallampati', label: 'Mallampati', section: 'patient', kind: 'enum', options: [1, 2, 3, 4] },
  { path: 'patient.airway.mouthOpeningCm', label: 'Mouth opening (cm)', section: 'patient', kind: 'number', optional: true },
  { path: 'patient.airway.thyromentalCm', label: 'Thyromental (cm)', section: 'patient', kind: 'number', optional: true },
  { path: 'patient.airway.neckMobility', label: 'Neck mobility', section: 'patient', kind: 'enum', options: ['normal', 'limited', 'immobile'], optional: true },
  { path: 'patient.airway.dentition', label: 'Dentition', section: 'patient', kind: 'string', optional: true },
  { path: 'patient.airway.notes', label: 'Airway notes', section: 'patient', kind: 'string', optional: true },
  { path: 'patient.plan', label: 'Case / anesthetic plan', section: 'patient', kind: 'string', optional: true },

  { path: 'baselineVitals.hr', label: 'HR', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.sbp', label: 'SBP', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.dbp', label: 'DBP', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.spo2', label: 'SpO₂', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.etco2', label: 'EtCO₂', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.rr', label: 'RR', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.temp', label: 'Temp (°C)', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.depth', label: 'Anesthetic depth', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.agentEt', label: 'Agent Et (%)', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.agentFi', label: 'Agent Fi (%)', section: 'vitals', kind: 'number' },
  { path: 'baselineVitals.rhythm', label: 'Rhythm', section: 'vitals', kind: 'enum', options: RHYTHMS },
  { path: 'baselineVitals.capnoShape', label: 'Capnograph shape', section: 'vitals', kind: 'enum', options: ['normal', 'bronchospasm', 'curare_cleft'], optional: true },
  { path: 'baselineVitals.pvcFrequency', label: 'PVC frequency', section: 'vitals', kind: 'enum', options: ['rare', 'occasional', 'trigeminy', 'bigeminy'], optional: true },
  { path: 'monitoring', label: 'Monitoring', section: 'vitals', kind: 'json', optional: true, hint: '{ "artLine": true } or { "nibpIntervalSec": 180 }' },

  { path: 'learningObjectives', label: 'Learning objectives', section: 'teaching', kind: 'stringList' },
  { path: 'setup', label: 'Setup', section: 'teaching', kind: 'stringList' },
  { path: 'expectedProgression', label: 'Expected progression', section: 'teaching', kind: 'stringList' },
  { path: 'correctManagement', label: 'Correct management', section: 'teaching', kind: 'stringList' },
  { path: 'commonErrors', label: 'Common errors', section: 'teaching', kind: 'stringList' },
  { path: 'debrief.points', label: 'Debrief points', section: 'teaching', kind: 'stringList' },
  { path: 'debrief.questions', label: 'Debrief questions', section: 'teaching', kind: 'stringList' },
];

export type ItemListKey = 'phases' | 'events' | 'expectedActions' | 'rubric';

export const ITEM_LISTS: { key: ItemListKey; label: string; section: SectionId }[] = [
  { key: 'phases', label: 'Phases', section: 'timeline' },
  { key: 'events', label: 'Events', section: 'timeline' },
  { key: 'expectedActions', label: 'Expected actions', section: 'assessment' },
  { key: 'rubric', label: 'Rubric categories', section: 'assessment' },
];

export const SPEC_BY_PATH = new Map(FIELD_SPECS.map((s) => [s.path, s]));

const ITEM_PATH_RE = /^(phases|events|expectedActions|rubric)\[(\d+)\]$/;

/** Human label for a path reported by `finalizeDraft`. */
export function labelForPath(path: string, fields: DraftFields): string {
  const spec = SPEC_BY_PATH.get(path);
  if (spec) return spec.label;
  const m = ITEM_PATH_RE.exec(path);
  if (m) {
    const list = fields[m[1] as ItemListKey] as DraftField<{ label?: string }>[];
    const item = list[Number(m[2])];
    const listLabel = ITEM_LISTS.find((l) => l.key === m[1])?.label ?? m[1];
    return `${listLabel}: ${item?.value?.label ?? `#${Number(m[2]) + 1}`}`;
  }
  return path;
}

export function getField(fields: DraftFields, path: string): DraftField<unknown> {
  let cur: unknown = fields;
  for (const seg of path.split('.')) cur = (cur as Record<string, unknown>)[seg];
  return cur as DraftField<unknown>;
}

/** Immutable update of one scalar/list field by dot path. */
export function setField(fields: DraftFields, path: string, next: DraftField<unknown>): DraftFields {
  const copy = JSON.parse(JSON.stringify(fields)) as DraftFields;
  const segs = path.split('.');
  let cur: Record<string, unknown> = copy as unknown as Record<string, unknown>;
  for (const seg of segs.slice(0, -1)) cur = cur[seg] as Record<string, unknown>;
  cur[segs[segs.length - 1]] = next;
  return copy;
}
