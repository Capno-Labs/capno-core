import { FIELD_LABELS, VITAL_NAMES } from '@/components/editor/fieldLabels';
import { plainMessage } from '@/components/editor/readiness';
import { DOMAINS } from '@/lib/engine/lint';
import {
  CAPNO_SHAPE_LABELS,
  PVC_FREQUENCY_LABELS,
  RHYTHM_LABELS,
  TRAINING_LEVEL_LABELS,
  type Rhythm,
  type TrainingLevel,
} from '@/lib/engine/types';
import { VITAL_META } from '@/lib/engine/vitals';
import type { DraftField, DraftFields } from '@/lib/import';

/**
 * The review screen's view of an `ImportDraft`: every scalar/list field
 * with its label, editor kind and owning editor section (so the review
 * groups fields the way the case editor does), plus the four item lists.
 * Labels come from the case editor (`editor/fieldLabels.ts`) and option
 * names from the engine's label maps. The option lists typed out here mirror
 * `src/lib/engine/schema.ts`; keep them in step when the scenario schema
 * changes (CLAUDE.md invariant 2).
 */

/**
 * How the review screen groups an imported draft's fields. Its own list, not
 * the case editor's rail: the review is a field-by-field check against the
 * source document, laid out in the document's order.
 */
export type SectionId = 'overview' | 'patient' | 'vitals' | 'timeline' | 'assessment' | 'teaching';

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'patient', label: 'Patient' },
  { id: 'vitals', label: 'Vitals & monitoring' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'teaching', label: 'Teaching & debrief' },
];

export type FieldKind = 'string' | 'number' | 'enum' | 'enumList' | 'stringList' | 'monitoring';

export interface FieldSpec {
  path: string;
  label: string;
  section: SectionId;
  kind: FieldKind;
  options?: readonly (string | number)[];
  /** Display text for an option, by its stored value; options without one show as stored. */
  optionLabels?: Record<string, string>;
  /** Shown after the label, as the editor shows it. */
  unit?: string;
  optional?: boolean;
  hint?: string;
}

export const RHYTHMS = Object.keys(RHYTHM_LABELS) as Rhythm[];
export const TRAINING_LEVELS = Object.keys(TRAINING_LEVEL_LABELS) as TrainingLevel[];

/** The editor's name for a field; the review and the editor never disagree on what a field is called. */
const name = (path: string): string => {
  const label = FIELD_LABELS[path];
  if (!label) throw new Error(`fieldLabels.ts has no label for "${path}"`);
  return label;
};
const vital = (key: keyof typeof VITAL_NAMES, optional = false): FieldSpec => ({
  path: `baselineVitals.${key}`,
  label: VITAL_NAMES[key],
  section: 'vitals',
  kind: 'number',
  unit: VITAL_META[key].unit || undefined,
  ...(optional ? { optional } : {}),
});
const numbered = (prefix: string, values: number[]) =>
  Object.fromEntries(values.map((n) => [String(n), `${prefix} ${n}`]));

export const FIELD_SPECS: FieldSpec[] = [
  { path: 'title', label: name('title'), section: 'overview', kind: 'string' },
  { path: 'id', label: name('id'), section: 'overview', kind: 'string', hint: 'Lowercase letters, numbers and dashes.' },
  { path: 'summary', label: name('summary'), section: 'overview', kind: 'string' },
  { path: 'tags.topics', label: 'Topics', section: 'overview', kind: 'stringList', hint: `One topic should be the curriculum area: ${DOMAINS.join(', ')}.` },
  { path: 'tags.difficulty', label: name('tags.difficulty'), section: 'overview', kind: 'enum', options: ['beginner', 'intermediate', 'advanced'], optionLabels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } },
  { path: 'tags.trainingLevels', label: name('tags.trainingLevels'), section: 'overview', kind: 'enumList', options: TRAINING_LEVELS, optionLabels: TRAINING_LEVEL_LABELS },
  { path: 'estimatedMinutes', label: name('estimatedMinutes'), section: 'overview', kind: 'number', unit: 'min' },
  { path: 'targetDurationSec', label: name('targetDurationSec'), section: 'overview', kind: 'number', unit: 'seconds', optional: true },
  { path: 'version', label: name('version'), section: 'overview', kind: 'string' },

  { path: 'patient.name', label: name('patient.name'), section: 'patient', kind: 'string' },
  { path: 'patient.age', label: name('patient.age'), section: 'patient', kind: 'number', unit: 'years' },
  { path: 'patient.sex', label: name('patient.sex'), section: 'patient', kind: 'enum', options: ['male', 'female'], optionLabels: { male: 'Male', female: 'Female' } },
  { path: 'patient.weightKg', label: name('patient.weightKg'), section: 'patient', kind: 'number', unit: 'kg' },
  { path: 'patient.heightCm', label: name('patient.heightCm'), section: 'patient', kind: 'number', unit: 'cm' },
  { path: 'patient.asa', label: name('patient.asa'), section: 'patient', kind: 'enum', options: [1, 2, 3, 4, 5, 6], optionLabels: numbered('ASA', [1, 2, 3, 4, 5, 6]) },
  { path: 'patient.allergies', label: name('patient.allergies'), section: 'patient', kind: 'stringList' },
  { path: 'patient.medications', label: name('patient.medications'), section: 'patient', kind: 'stringList' },
  { path: 'patient.pmh', label: name('patient.pmh'), section: 'patient', kind: 'stringList' },
  { path: 'patient.airway.mallampati', label: name('patient.airway.mallampati'), section: 'patient', kind: 'enum', options: [1, 2, 3, 4], optionLabels: numbered('Class', [1, 2, 3, 4]) },
  { path: 'patient.airway.mouthOpeningCm', label: name('patient.airway.mouthOpeningCm'), section: 'patient', kind: 'number', unit: 'cm', optional: true },
  { path: 'patient.airway.thyromentalCm', label: name('patient.airway.thyromentalCm'), section: 'patient', kind: 'number', unit: 'cm', optional: true },
  { path: 'patient.airway.neckMobility', label: name('patient.airway.neckMobility'), section: 'patient', kind: 'enum', options: ['normal', 'limited', 'immobile'], optionLabels: { normal: 'Normal', limited: 'Limited', immobile: 'Immobile' }, optional: true },
  { path: 'patient.airway.dentition', label: name('patient.airway.dentition'), section: 'patient', kind: 'string', optional: true },
  { path: 'patient.airway.notes', label: name('patient.airway.notes'), section: 'patient', kind: 'string', optional: true },
  { path: 'patient.plan', label: name('patient.plan'), section: 'patient', kind: 'string', optional: true },

  vital('hr'),
  vital('sbp'),
  vital('dbp'),
  vital('spo2'),
  vital('etco2'),
  vital('rr'),
  vital('temp'),
  vital('depth'),
  vital('agentEt'),
  vital('agentFi'),
  { path: 'baselineVitals.rhythm', label: name('baselineVitals.rhythm'), section: 'vitals', kind: 'enum', options: RHYTHMS, optionLabels: RHYTHM_LABELS },
  { path: 'baselineVitals.capnoShape', label: name('baselineVitals.capnoShape'), section: 'vitals', kind: 'enum', options: Object.keys(CAPNO_SHAPE_LABELS), optionLabels: CAPNO_SHAPE_LABELS, optional: true },
  { path: 'baselineVitals.pvcFrequency', label: name('baselineVitals.pvcFrequency'), section: 'vitals', kind: 'enum', options: Object.keys(PVC_FREQUENCY_LABELS), optionLabels: PVC_FREQUENCY_LABELS, optional: true },
  { path: 'monitoring', label: 'Monitoring', section: 'vitals', kind: 'monitoring', optional: true },

  { path: 'learningObjectives', label: name('learningObjectives'), section: 'teaching', kind: 'stringList' },
  { path: 'setup', label: name('setup'), section: 'teaching', kind: 'stringList' },
  { path: 'expectedProgression', label: name('expectedProgression'), section: 'teaching', kind: 'stringList' },
  { path: 'correctManagement', label: name('correctManagement'), section: 'teaching', kind: 'stringList' },
  { path: 'commonErrors', label: name('commonErrors'), section: 'teaching', kind: 'stringList' },
  { path: 'debrief.points', label: name('debrief.points'), section: 'teaching', kind: 'stringList' },
  { path: 'debrief.questions', label: name('debrief.questions'), section: 'teaching', kind: 'stringList' },
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

/**
 * Human label for an entry reported by `finalizeDraft`: the path of a field
 * still to decide, or — once every field is decided — a schema problem
 * ("patient.age: Number must be less than or equal to 120").
 */
export function labelForPath(entry: string, fields: DraftFields): string {
  const colon = entry.indexOf(': ');
  if (colon > 0 && !/\s/.test(entry.slice(0, colon))) {
    const path = entry.slice(0, colon);
    // Schema paths index lists with dots ("events.2.label"); the draft's use brackets.
    const item = /^(phases|events|expectedActions|rubric)\.(\d+)/.exec(path);
    const where = item
      ? labelForPath(`${item[1]}[${item[2]}]`, fields)
      : labelForPath(path.replace(/\.\d+$/, ''), fields);
    return `${where}: ${plainMessage(entry.slice(colon + 2), path)}`;
  }
  const spec = SPEC_BY_PATH.get(entry);
  // Out of its section, "Name" alone does not say whose.
  if (spec) return entry === 'patient.name' ? 'Patient name' : spec.label;
  const m = ITEM_PATH_RE.exec(entry);
  if (m) {
    const list = fields[m[1] as ItemListKey] as DraftField<{ label?: string }>[];
    const item = list[Number(m[2])];
    const listLabel = ITEM_LISTS.find((l) => l.key === m[1])?.label ?? m[1];
    return `${listLabel}: ${item?.value?.label || `#${Number(m[2]) + 1}`}`;
  }
  return FIELD_LABELS[entry] ?? entry;
}

/** The element id of the review row an entry from `finalizeDraft` belongs to. */
export function rowIdForEntry(entry: string): string {
  const colon = entry.indexOf(': ');
  const path = colon > 0 && !/\s/.test(entry.slice(0, colon)) ? entry.slice(0, colon) : entry;
  const item = /^(phases|events|expectedActions|rubric)\.(\d+)/.exec(path);
  if (item) return `field-${item[1]}[${item[2]}]`;
  if (SPEC_BY_PATH.has(path)) return `field-${path}`;
  // A list entry ("setup.2") or a key inside a grouped field ("monitoring.nibpIntervalSec").
  const segs = path.split('.');
  while (segs.length > 1) {
    segs.pop();
    if (SPEC_BY_PATH.has(segs.join('.'))) return `field-${segs.join('.')}`;
  }
  return `field-${path}`;
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
