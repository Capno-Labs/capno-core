import type {
  AirwayExam,
  CapnoShape,
  Difficulty,
  ExpectedAction,
  MonitoringConfig,
  Patient,
  Phase,
  PvcFrequency,
  Rhythm,
  RubricCategory,
  ScenarioEvent,
  TrainingLevel,
  Vitals,
} from '../engine/types';

/**
 * Run-sheet import: the typed draft that sits between a faculty document
 * and a `Scenario`.
 *
 * A `Scenario` is strict (patient, baseline vitals, ≥1 phase, ≥1 expected
 * action…). An honest extraction of an existing instructor run sheet
 * usually cannot satisfy it — most run sheets never state vital signs —
 * so the draft carries every scenario field separately, each with a
 * status and a provenance pointer back into the parsed source, and only
 * `finalizeDraft()` (all required fields resolved by faculty) turns it
 * into a `Scenario` that enters the normal save/version/publish path.
 *
 * Nothing in this module is allowed to invent clinical content: a field
 * the source does not state is `unresolved` with `value: null`, never a
 * default (CLAUDE.md invariant 7).
 */

export const EXTRACTION_SCHEMA_VERSION = 1 as const;

/** Tag every imported scenario carries (provenance; stays after review). */
export const IMPORTED_TAG = 'imported';

// ── Parsed source ────────────────────────────────────────────────────────────

export type BlockKind = 'heading' | 'paragraph' | 'listItem' | 'table';

/**
 * One unit of source text. Ids are stable for a given document so the
 * review UI can highlight the block a draft field cites. Produced by the
 * in-app text parser (`parseText`) or by the hosted DOCX/PDF service —
 * both emit exactly this shape.
 */
export interface SourceBlock {
  id: string;
  /** 1-based page (PDF sources); absent for DOCX/pasted text. */
  page?: number;
  /** 1-based position in document order. */
  paragraph: number;
  kind: BlockKind;
  /** Heading level 1-6 (headings only). */
  level?: number;
  /** Plain text; table cells are joined with " | " per row and "\n" per row. */
  text: string;
  /** Table rows (header row first), tables only. */
  tableCells?: string[][];
}

export interface ParsedDocument {
  schemaVersion: typeof EXTRACTION_SCHEMA_VERSION;
  /** Display name of the source (file name or "Pasted text"). */
  title?: string;
  blocks: SourceBlock[];
  pageCount?: number;
  /** PDF with little or no extractable text — needs the DOCX or a paste. */
  scanned?: boolean;
}

// ── Draft fields ─────────────────────────────────────────────────────────────

export type ProvenanceMethod = 'parser' | 'llm' | 'faculty';

export interface Provenance {
  method: ProvenanceMethod;
  blockId?: string;
  page?: number;
  paragraph?: number;
  /** Verbatim excerpt supporting the value (≤ 300 chars). */
  quote?: string;
  /** Model identifier, llm method only. */
  model?: string;
}

/**
 * extracted  — quoted verbatim from the source by a deterministic parser.
 * proposed   — suggested (e.g. by an LLM) without a verifiable quote; must
 *              be confirmed by faculty before it can finalize.
 * unresolved — the source does not state it; faculty must supply it or,
 *              for optional fields, mark it not applicable.
 * confirmed  — faculty accepted or edited the value.
 */
export type FieldStatus = 'extracted' | 'proposed' | 'unresolved' | 'confirmed';

export interface DraftField<T> {
  /** null ⇔ not specified in the source (never a default). */
  value: T | null;
  status: FieldStatus;
  provenance: Provenance | null;
  /** Extractor or faculty remark ("doc gives HR as 'tachycardic'"). */
  note?: string;
}

type Draftify<T> = { [K in keyof T]-?: DraftField<NonNullable<T[K]>> };

export interface DraftTags {
  topics: DraftField<string[]>;
  difficulty: DraftField<Difficulty>;
  trainingLevels: DraftField<TrainingLevel[]>;
}

export type DraftAirway = Draftify<AirwayExam>;

export type DraftPatient = Draftify<Omit<Patient, 'airway'>> & { airway: DraftAirway };

export type DraftVitals = Draftify<Omit<Vitals, 'rhythm' | 'capnoShape' | 'pvcFrequency'>> & {
  rhythm: DraftField<Rhythm>;
  capnoShape: DraftField<CapnoShape>;
  pvcFrequency: DraftField<PvcFrequency>;
};

export interface DraftDebrief {
  points: DraftField<string[]>;
  questions: DraftField<string[]>;
}

export interface DraftFields {
  id: DraftField<string>;
  version: DraftField<string>;
  title: DraftField<string>;
  summary: DraftField<string>;
  tags: DraftTags;
  learningObjectives: DraftField<string[]>;
  setup: DraftField<string[]>;
  patient: DraftPatient;
  baselineVitals: DraftVitals;
  phases: DraftField<Phase>[];
  events: DraftField<ScenarioEvent>[];
  expectedActions: DraftField<ExpectedAction>[];
  expectedProgression: DraftField<string[]>;
  correctManagement: DraftField<string[]>;
  commonErrors: DraftField<string[]>;
  debrief: DraftDebrief;
  rubric: DraftField<RubricCategory>[];
  estimatedMinutes: DraftField<number>;
  targetDurationSec: DraftField<number>;
  monitoring: DraftField<MonitoringConfig>;
}

export interface ImportDraft {
  extractionSchemaVersion: typeof EXTRACTION_SCHEMA_VERSION;
  /** Local draft id (one source document can yield several drafts). */
  draftId: string;
  /** Id of the parsed source this draft was extracted from. */
  sourceId: string;
  /** Hosted import job, when the source came through the import service. */
  jobId?: string;
  /** Parser profile that produced the draft (for the review rail / backlog). */
  profile: string;
  fields: DraftFields;
  /** Source blocks the extractor could not place — shown in the review rail. */
  unmappedBlockIds: string[];
  createdAtIso: string;
  updatedAtIso: string;
}
