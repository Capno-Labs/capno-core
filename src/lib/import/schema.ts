import { z } from 'zod';
import { eventSchema } from '../engine/schema';
import type { ImportDraft, ParsedDocument } from './types';
import { EXTRACTION_SCHEMA_VERSION } from './types';

/**
 * Zod mirrors of `ParsedDocument` and `ImportDraft` — applied wherever a
 * draft or parsed source crosses a trust boundary (localStorage, the
 * hosted import service), by the same rule as `pullScenarios`: never
 * trust stored or remote data more than a file.
 *
 * Field *values* are deliberately loose here (a draft may hold partial or
 * not-yet-valid content); `finalizeDraft` applies the strict scenario
 * schema at the end.
 */

const blockKind = z.enum(['heading', 'paragraph', 'listItem', 'table']);

export const sourceBlockSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().positive().optional(),
  paragraph: z.number().int().positive(),
  kind: blockKind,
  level: z.number().int().min(1).max(6).optional(),
  text: z.string(),
  tableCells: z.array(z.array(z.string())).optional(),
});

export const parsedDocumentSchema = z.object({
  schemaVersion: z.literal(EXTRACTION_SCHEMA_VERSION),
  title: z.string().optional(),
  blocks: z.array(sourceBlockSchema),
  pageCount: z.number().int().positive().optional(),
  scanned: z.boolean().optional(),
});

const provenanceSchema = z.object({
  method: z.enum(['parser', 'llm', 'faculty']),
  blockId: z.string().optional(),
  page: z.number().int().positive().optional(),
  paragraph: z.number().int().positive().optional(),
  quote: z.string().max(300).optional(),
  model: z.string().optional(),
});

const fieldStatus = z.enum(['extracted', 'proposed', 'unresolved', 'confirmed']);

function field<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    value: value.nullable(),
    status: fieldStatus,
    provenance: provenanceSchema.nullable(),
    note: z.string().optional(),
  });
}

const str = field(z.string());
const strList = field(z.array(z.string()));
const num = field(z.number());

const draftPatientSchema = z.object({
  name: str,
  age: num,
  sex: field(z.enum(['male', 'female'])),
  weightKg: num,
  heightCm: num,
  asa: field(z.number().int().min(1).max(6)),
  allergies: strList,
  medications: strList,
  pmh: strList,
  airway: z.object({
    mallampati: field(z.number().int().min(1).max(4)),
    mouthOpeningCm: num,
    thyromentalCm: num,
    neckMobility: field(z.enum(['normal', 'limited', 'immobile'])),
    dentition: str,
    notes: str,
  }),
  plan: str,
});

const draftVitalsSchema = z.object({
  hr: num,
  sbp: num,
  dbp: num,
  spo2: num,
  etco2: num,
  rr: num,
  temp: num,
  depth: num,
  agentEt: num,
  agentFi: num,
  rhythm: str,
  capnoShape: str,
  pvcFrequency: str,
});

export const draftPhaseValueSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  targetDurationSec: z.number().optional(),
});

export const draftActionValueSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  phase: z.string().optional(),
  critical: z.boolean(),
  points: z.number(),
});

export const draftRubricValueSchema = z.object({
  id: z.string(),
  label: z.string(),
  actionIds: z.array(z.string()),
});

const monitoringValue = z.object({
  artLine: z.boolean().optional(),
  nibpIntervalSec: z.number().optional(),
});

export const importDraftSchema = z.object({
  extractionSchemaVersion: z.literal(EXTRACTION_SCHEMA_VERSION),
  draftId: z.string().min(1),
  sourceId: z.string().min(1),
  jobId: z.string().optional(),
  profile: z.string(),
  fields: z.object({
    id: str,
    version: str,
    title: str,
    summary: str,
    tags: z.object({
      topics: strList,
      difficulty: field(z.enum(['beginner', 'intermediate', 'advanced'])),
      trainingLevels: strList,
    }),
    learningObjectives: strList,
    setup: strList,
    patient: draftPatientSchema,
    baselineVitals: draftVitalsSchema,
    phases: z.array(field(draftPhaseValueSchema)),
    // Events reuse the engine's event schema so effect values are range-checked
    // even while the draft is still in review.
    events: z.array(field(eventSchema)),
    expectedActions: z.array(field(draftActionValueSchema)),
    expectedProgression: strList,
    correctManagement: strList,
    commonErrors: strList,
    debrief: z.object({ points: strList, questions: strList }),
    rubric: z.array(field(draftRubricValueSchema)),
    estimatedMinutes: num,
    targetDurationSec: num,
    monitoring: field(monitoringValue),
  }),
  unmappedBlockIds: z.array(z.string()),
  createdAtIso: z.string(),
  updatedAtIso: z.string(),
});

/** Validate an untrusted parsed document. Throws ZodError. */
export function parseParsedDocument(data: unknown): ParsedDocument {
  return parsedDocumentSchema.parse(data) as ParsedDocument;
}

/** Validate an untrusted draft. Throws ZodError. */
export function parseImportDraft(data: unknown): ImportDraft {
  return importDraftSchema.parse(data) as ImportDraft;
}

/** Validate without throwing; returns human-readable problems. */
export function validateImportDraft(data: unknown): { ok: boolean; errors: string[] } {
  const result = importDraftSchema.safeParse(data);
  if (result.success) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}
