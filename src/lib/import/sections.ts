import type { EventCategory, ExpectedAction, Phase, RubricCategory, ScenarioEvent } from '../engine/types';
import type {
  DraftField,
  DraftFields,
  ImportDraft,
  ParsedDocument,
  Provenance,
  SourceBlock,
} from './types';
import { EXTRACTION_SCHEMA_VERSION } from './types';

/**
 * Deterministic section heuristics: `ParsedDocument` → one `ImportDraft`
 * per scenario the run sheet describes. No LLM, no defaults.
 *
 * Two document families are recognized (the layouts the CWRU MSA labs use;
 * the fixtures next to the tests are synthetic examples of each):
 *
 *   cwru-guide    — the original instructor guide: `Objective`, `Equipment`,
 *                   `Instructor Pre-brief`, `Scenario N – <case>` with a
 *                   `Patient –` paragraph, `Goals`, phase headings
 *                   (`Induction/Intubation`, `Maintenance`,
 *                   `Emergence/Extubation`), `Instructor Debrief`, and an
 *                   `Assessment Tool` table (Task | Performs | Performs with
 *                   Assistance | Does Not Perform, rows marked `(N)`).
 *   cwru-playbook — the standardized instructor playbook: `SECTION N`
 *                   banners, ALL-CAPS checklist headings, a per-scenario
 *                   at-a-glance table (Row | Content) and a timeline table
 *                   (Stage | Instructor action | … | SIM ACTION | Expected
 *                   student actions | Progress when).
 *   generic       — anything else: one draft, headings matched loosely.
 *
 * Everything the parser places is `extracted` with a quote of the block it
 * came from. The handful of inferences it makes (patient sex from a
 * pronoun, neck mobility from "limited neck mobility") are `proposed`.
 * Vitals, doses, timings, patient demographics and event effects are
 * never guessed: absent from the source ⇒ `unresolved`.
 */

export type ImportProfile = 'cwru-guide' | 'cwru-playbook' | 'generic';

export interface ExtractOptions {
  sourceId?: string;
  /** Injectable clock for deterministic tests. */
  now?: () => string;
}

export interface ExtractResult {
  profile: ImportProfile;
  drafts: ImportDraft[];
}

// ── Heading vocabularies ─────────────────────────────────────────────────────

const SCENARIO_RE = /^scenario\s*(\d+)\s*(?:[-–—:]\s*)?(.*)$/i;
const OBJECTIVES_RE = /objective/i;
const SETUP_RE =
  /equip|set[ -]?up|suppl|pre-?brief|handout|before you start|special notes|assessment forms|checklist|^say\b|simulator setup|imaging/i;
const DEBRIEF_RE = /debrief/i;
const ASSESSMENT_RE = /assessment tool|rubric|^assessment/i;
const ACTIVITY_RE = /^activity/i;
const GOALS_RE = /^goal/i;
const PATIENT_RE = /^\**patient\**\s*(?:summary)?\s*[-–—:]\s*(.*)$/i;
const SECTION_BANNER_RE = /^section\s*\d|^part\s*\d|^how to run|^quick instructor/i;
const RUBRIC_HEADER_RE = /performs/i;
const TIMELINE_HEADER_RE = /stage/i;
const TIMELINE_STUDENT_RE = /expected student/i;
const GLANCE_HEADER_RE = /^row$/i;

// ── Field helpers ────────────────────────────────────────────────────────────

const QUOTE_LIMIT = 300;

function prov(block: SourceBlock, quote?: string): Provenance {
  const q = (quote ?? block.text).slice(0, QUOTE_LIMIT);
  return {
    method: 'parser',
    blockId: block.id,
    paragraph: block.paragraph,
    ...(block.page !== undefined ? { page: block.page } : {}),
    quote: q,
  };
}

function extracted<T>(value: T, block: SourceBlock, quote?: string): DraftField<T> {
  return { value, status: 'extracted', provenance: prov(block, quote) };
}

function proposed<T>(value: T, block: SourceBlock, quote: string, note: string): DraftField<T> {
  return { value, status: 'proposed', provenance: prov(block, quote), note };
}

function unresolved<T>(note?: string): DraftField<T> {
  return { value: null, status: 'unresolved', provenance: null, ...(note ? { note } : {}) };
}

const NOT_IN_SOURCE = 'Not specified in the source document';

export function slugId(text: string, fallback = 'item'): string {
  const slug = text
    .toLowerCase()
    .replace(/\(\d+\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  if (!slug) return fallback;
  return /^[a-z0-9]/.test(slug) ? slug : `x-${slug}`;
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function shortLabel(text: string, max = 80): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const label = first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
  return label || text.slice(0, max);
}

function eventCategory(text: string): EventCategory {
  if (/intubat|airway|mask|laryngo|\blma\b|bougie|ventilat|cords?\b|extubat/i.test(text)) return 'airway';
  if (/\bdrug|dose|\bmg\b|propofol|relaxant|epinephrine|succinyl|rocuron/i.test(text)) return 'drug';
  if (/equipment|monitor|video|scope|machine|circuit/i.test(text)) return 'equipment';
  if (/surge|incision|bleed/i.test(text)) return 'surgical';
  if (/pulse ox|saturat|hypotens|brady|tachy|pressure|heart rate|\bhr\b|\bbp\b|etco2|spo2/i.test(text))
    return 'physiology';
  return 'other';
}

function emptyFields(): DraftFields {
  const u = <T,>() => unresolved<T>(NOT_IN_SOURCE);
  return {
    id: u(),
    version: { value: '1.0.0', status: 'confirmed', provenance: null, note: 'Initial version' },
    title: u(),
    summary: u(),
    tags: { topics: u(), difficulty: u(), trainingLevels: u() },
    learningObjectives: u(),
    setup: u(),
    patient: {
      name: u(),
      age: u(),
      sex: u(),
      weightKg: u(),
      heightCm: u(),
      asa: u(),
      allergies: u(),
      medications: u(),
      pmh: u(),
      airway: {
        mallampati: u(),
        mouthOpeningCm: u(),
        thyromentalCm: u(),
        neckMobility: u(),
        dentition: u(),
        notes: u(),
      },
      plan: u(),
    },
    baselineVitals: {
      hr: u(),
      sbp: u(),
      dbp: u(),
      spo2: u(),
      etco2: u(),
      rr: u(),
      temp: u(),
      depth: u(),
      agentEt: u(),
      agentFi: u(),
      rhythm: u(),
      capnoShape: u(),
      pvcFrequency: u(),
    },
    phases: [],
    events: [],
    expectedActions: [],
    expectedProgression: u(),
    correctManagement: u(),
    commonErrors: u(),
    debrief: { points: u(), questions: u() },
    rubric: [],
    estimatedMinutes: u(),
    targetDurationSec: u(),
    monitoring: u(),
  };
}

// ── Document walk ────────────────────────────────────────────────────────────

interface Section {
  heading: SourceBlock | null;
  body: SourceBlock[];
}

function sectionize(blocks: SourceBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: null, body: [] };
  for (const b of blocks) {
    if (b.kind === 'heading') {
      if (current.heading || current.body.length) sections.push(current);
      current = { heading: b, body: [] };
    } else {
      current.body.push(b);
    }
  }
  if (current.heading || current.body.length) sections.push(current);
  return sections;
}

function scenarioNumber(heading: SourceBlock | null): { n: number; title: string } | null {
  if (!heading) return null;
  const m = SCENARIO_RE.exec(heading.text.trim());
  if (!m) return null;
  return { n: Number(m[1]), title: m[2].trim() };
}

function isTerminator(heading: SourceBlock | null): boolean {
  if (!heading) return false;
  return DEBRIEF_RE.test(heading.text) || ASSESSMENT_RE.test(heading.text) || SECTION_BANNER_RE.test(heading.text);
}

export function detectProfile(doc: ParsedDocument): ImportProfile {
  const texts = doc.blocks.map((b) => b.text);
  if (texts.some((t) => /instructor playbook|scenario-at-a-glance|^section\s*\d/i.test(t))) return 'cwru-playbook';
  const headings = doc.blocks.filter((b) => b.kind === 'heading').map((b) => b.text);
  const guideMarks = headings.filter(
    (h) => SCENARIO_RE.test(h) || /^objective|instructor pre-?brief|assessment tool|instructor debrief/i.test(h),
  );
  if (guideMarks.length >= 2) return 'cwru-guide';
  return 'generic';
}

// ── Rubric tables ────────────────────────────────────────────────────────────

interface RubricRow {
  block: SourceBlock;
  scenario: number | null;
  task: string;
  label: string;
  description: string;
}

function isRubricTable(block: SourceBlock): boolean {
  const header = block.tableCells?.[0];
  return Boolean(header && header.some((c) => RUBRIC_HEADER_RE.test(c)));
}

function parseRubricTable(block: SourceBlock): RubricRow[] {
  const rows = block.tableCells ?? [];
  const header = rows[0] ?? [];
  const col = (re: RegExp, fallback: number) => {
    const i = header.findIndex((h) => re.test(h));
    return i >= 0 ? i : fallback;
  };
  const taskCol = col(/task|item|criterion/i, 0);
  const performsCol = header.findIndex((h, i) => i !== taskCol && /^performs$/i.test(h.trim()));
  const labelCol = performsCol >= 0 ? performsCol : taskCol === 0 ? 1 : 0;
  const detailCols = header
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== taskCol && i !== labelCol && i < header.length);
  const out: RubricRow[] = [];
  for (const cells of rows.slice(1)) {
    const task = (cells[taskCol] ?? '').trim();
    if (!task) continue;
    const marker = /\((\d+)\)\s*$/.exec(task);
    const label = (cells[labelCol] ?? '').trim() || task.replace(/\(\d+\)\s*$/, '').trim();
    const description = detailCols
      .map(({ h, i }) => {
        const v = (cells[i] ?? '').trim();
        return v ? `${h.trim()}: ${v}` : null;
      })
      .filter((s): s is string => Boolean(s))
      .join('\n');
    out.push({
      block,
      scenario: marker ? Number(marker[1]) : null,
      task: task.replace(/\(\d+\)\s*$/, '').trim(),
      label,
      description,
    });
  }
  return out;
}

// ── Scenario assembly ────────────────────────────────────────────────────────

interface ScenarioAccumulator {
  n: number;
  title: string;
  heading: SourceBlock;
  sections: Section[];
}

interface Shared {
  objectives: { items: string[]; block: SourceBlock } | null;
  setup: { items: string[]; block: SourceBlock } | null;
  debriefPoints: { items: string[]; block: SourceBlock } | null;
  debriefQuestions: { items: string[]; block: SourceBlock } | null;
  rubricRows: RubricRow[];
  docTitle: SourceBlock | null;
}

function textItems(body: SourceBlock[]): string[] {
  return body.filter((b) => b.kind !== 'table').map((b) => b.text.trim()).filter(Boolean);
}

function listOrText(body: SourceBlock[]): string[] {
  const items = body.filter((b) => b.kind === 'listItem').map((b) => b.text.trim());
  return items.length ? items : textItems(body);
}

function appendList(
  target: { items: string[]; block: SourceBlock } | null,
  items: string[],
  block: SourceBlock,
): { items: string[]; block: SourceBlock } | null {
  if (items.length === 0) return target;
  if (!target) return { items: [...items], block };
  return { items: [...target.items, ...items], block: target.block };
}

function splitQuestions(items: string[]): { points: string[]; questions: string[] } {
  const questions = items.filter((i) => /\?\s*$/.test(i));
  const points = items.filter((i) => !/\?\s*$/.test(i));
  return { points, questions };
}

function buildDraft(
  acc: ScenarioAccumulator | null,
  shared: Shared,
  consumed: Set<string>,
  doc: ParsedDocument,
  opts: Required<ExtractOptions>,
  profile: ImportProfile,
): ImportDraft {
  const f = emptyFields();
  const ids = new Set<string>();
  const phases: DraftField<Phase>[] = [];
  const events: DraftField<ScenarioEvent>[] = [];
  const actions: DraftField<ExpectedAction>[] = [];
  let progressionAcc: { items: string[]; block: SourceBlock } | null = null;
  let setupAcc = shared.setup;
  let objectivesAcc = shared.objectives;
  const goals: { items: string[]; block: SourceBlock }[] = [];

  // Title / id.
  const titleBlock = acc?.heading ?? shared.docTitle;
  const titleText = acc ? acc.title || `Scenario ${acc.n}` : (shared.docTitle?.text ?? doc.title ?? '');
  if (titleBlock && titleText) {
    f.title = extracted(titleText, titleBlock);
    f.id = proposed(slugId(titleText, 'imported-scenario'), titleBlock, titleBlock.text, 'Derived from the title');
    consumed.add(titleBlock.id);
  }

  const takePatient = (block: SourceBlock, text: string) => {
    f.patient.plan = extracted(text, block);
    if (f.summary.status === 'unresolved') f.summary = extracted(text, block);
    if (/\b(she|her|female|woman)\b/i.test(text)) {
      f.patient.sex = proposed('female', block, text, 'Inferred from a pronoun in the patient description');
    } else if (/\b(he|his|male|man)\b/i.test(text)) {
      f.patient.sex = proposed('male', block, text, 'Inferred from a pronoun in the patient description');
    }
    if (/limited neck (mobility|rom|range)/i.test(text)) {
      f.patient.airway.neckMobility = proposed('limited', block, text, 'Inferred from "limited neck mobility"');
    }
    consumed.add(block.id);
  };

  const addPhase = (label: string, block: SourceBlock, description: string | undefined) => {
    const id = uniqueId(slugId(label, 'phase'), ids);
    phases.push(
      extracted<Phase>({ id, label, ...(description ? { description } : {}) }, block),
    );
    return id;
  };

  const addEvent = (text: string, block: SourceBlock, phaseId: string | undefined) => {
    const id = uniqueId(slugId(shortLabel(text, 40), 'event'), ids);
    const value: ScenarioEvent = {
      id,
      label: shortLabel(text),
      description: text,
      category: eventCategory(text),
      effects: [],
      ...(phaseId ? { phaseHint: phaseId } : {}),
    };
    events.push({
      value,
      status: 'unresolved',
      provenance: prov(block, text),
      note: 'Vital-sign effects are not specified in the source — add effects or confirm as a cue-only event',
    });
  };

  const addAction = (
    label: string,
    block: SourceBlock,
    extra: { description?: string; phase?: string; idBase?: string },
  ) => {
    const id = uniqueId(slugId(extra.idBase ?? shortLabel(label, 40), 'action'), ids);
    const value: ExpectedAction = {
      id,
      label,
      ...(extra.description ? { description: extra.description } : {}),
      ...(extra.phase ? { phase: extra.phase } : {}),
      critical: false,
      points: 0,
    };
    actions.push(extracted(value, block, label));
    return id;
  };

  for (const section of acc?.sections ?? []) {
    const h = section.heading;
    const headingText = h?.text ?? '';
    if (h) consumed.add(h.id);
    const tables = section.body.filter((b) => b.kind === 'table');
    const prose = section.body.filter((b) => b.kind !== 'table');

    // Patient paragraph(s) can sit directly under the scenario heading.
    for (const b of prose) {
      const m = PATIENT_RE.exec(b.text.trim());
      if (m) takePatient(b, m[1].trim());
    }
    const rest = prose.filter((b) => !consumed.has(b.id));

    // At-a-glance (Row | Content) and timeline (Stage | … | Expected student …) tables.
    for (const t of tables) {
      const header = t.tableCells?.[0] ?? [];
      if (header.length >= 2 && GLANCE_HEADER_RE.test(header[0].trim())) {
        for (const row of (t.tableCells ?? []).slice(1)) {
          const key = (row[0] ?? '').trim();
          const val = (row[1] ?? '').trim();
          if (!val) continue;
          if (/patient/i.test(key)) takePatient(t, val);
          else if (/objective/i.test(key)) {
            objectivesAcc = { items: val.split(/;\s*/).map((s) => s.trim()).filter(Boolean), block: t };
          } else if (/critical event|expected student/i.test(key)) {
            progressionAcc = appendList(progressionAcc, [val], t);
          } else if (/procedure/i.test(key) && f.summary.status === 'unresolved') {
            f.summary = extracted(val, t, val);
          }
        }
        consumed.add(t.id);
        continue;
      }
      if (header.some((c) => TIMELINE_HEADER_RE.test(c)) && header.some((c) => TIMELINE_STUDENT_RE.test(c))) {
        const stageCol = header.findIndex((c) => TIMELINE_HEADER_RE.test(c));
        const simCol = header.findIndex((c) => /sim/i.test(c));
        const studentCol = header.findIndex((c) => TIMELINE_STUDENT_RE.test(c));
        const instrCol = header.findIndex((c) => /instructor/i.test(c));
        const progressCol = header.findIndex((c) => /progress|move on|ends when/i.test(c));
        for (const row of (t.tableCells ?? []).slice(1)) {
          const stage = (row[stageCol] ?? '').trim();
          if (!stage) continue;
          const parts: string[] = [];
          if (instrCol >= 0 && row[instrCol]?.trim()) parts.push(row[instrCol].trim());
          if (progressCol >= 0 && row[progressCol]?.trim()) parts.push(`Progress when: ${row[progressCol].trim()}`);
          const phaseId = addPhase(stage, t, parts.length ? parts.join('\n') : undefined);
          const sim = simCol >= 0 ? (row[simCol] ?? '').trim() : '';
          if (sim && !/^[—–-]+$/.test(sim)) addEvent(sim, t, phaseId);
          const student = studentCol >= 0 ? (row[studentCol] ?? '').trim() : '';
          if (student) {
            goals.push({ items: student.split(/;\s*/).map((s) => s.trim()).filter(Boolean), block: t });
          }
        }
        consumed.add(t.id);
        continue;
      }
      if (isRubricTable(t)) {
        // Routed globally below (rows carry their own scenario markers).
        continue;
      }
    }

    // Blocks directly under the scenario heading that are not the patient
    // line stay unmapped (shown in the review rail).
    if (!h) continue;

    if (GOALS_RE.test(headingText)) {
      const items = listOrText(rest);
      if (items.length) goals.push({ items, block: h });
      rest.forEach((b) => consumed.add(b.id));
    } else if (SETUP_RE.test(headingText)) {
      setupAcc = appendList(setupAcc, listOrText(rest), h);
      rest.forEach((b) => consumed.add(b.id));
    } else if (ACTIVITY_RE.test(headingText)) {
      progressionAcc = appendList(progressionAcc, textItems(rest), h);
      rest.forEach((b) => consumed.add(b.id));
    } else if (OBJECTIVES_RE.test(headingText)) {
      objectivesAcc = { items: listOrText(rest), block: h };
      rest.forEach((b) => consumed.add(b.id));
    } else if (rest.length > 0 || tables.length === 0) {
      // Any other sub-heading inside a scenario is a phase of care.
      const label = headingText.replace(/[\s\-–—:]+$/g, '').trim();
      const paragraphs = rest.filter((b) => b.kind === 'paragraph').map((b) => b.text.trim());
      const phaseId = addPhase(label, h, paragraphs.length ? paragraphs.join('\n') : undefined);
      for (const b of rest) {
        if (b.kind === 'listItem') addEvent(b.text.trim(), b, phaseId);
        consumed.add(b.id);
      }
    }
  }

  // Rubric rows routed to this scenario (or unmarked rows → every scenario).
  const rubricRows = shared.rubricRows.filter((r) => r.scenario === null || acc === null || r.scenario === acc.n);
  const categories = new Map<string, DraftField<RubricCategory>>();
  for (const row of rubricRows) {
    const actionId = addAction(row.label, row.block, {
      description: row.description || undefined,
      idBase: `${slugId(row.task, 'rubric')}-${rubricRows.indexOf(row) + 1}`,
    });
    const catId = slugId(row.task, 'category');
    const existing = categories.get(catId);
    if (existing && existing.value) {
      existing.value.actionIds.push(actionId);
    } else {
      categories.set(
        catId,
        extracted<RubricCategory>({ id: catId, label: row.task, actionIds: [actionId] }, row.block, row.task),
      );
    }
    consumed.add(row.block.id);
  }

  // Goals / "Students should" lines: graded actions when no rubric covers
  // this scenario, otherwise the expected progression narrative.
  if (actions.length === 0) {
    for (const g of goals) for (const item of g.items) addAction(item, g.block, {});
  } else {
    for (const g of goals) progressionAcc = appendList(progressionAcc, g.items, g.block);
  }

  if (objectivesAcc) f.learningObjectives = extracted(objectivesAcc.items, objectivesAcc.block);
  if (setupAcc) f.setup = extracted(setupAcc.items, setupAcc.block);
  if (progressionAcc) f.expectedProgression = extracted(progressionAcc.items, progressionAcc.block);
  if (shared.debriefPoints) f.debrief.points = extracted(shared.debriefPoints.items, shared.debriefPoints.block);
  if (shared.debriefQuestions)
    f.debrief.questions = extracted(shared.debriefQuestions.items, shared.debriefQuestions.block);

  f.phases = phases;
  f.events = events;
  f.expectedActions = actions;
  f.rubric = [...categories.values()];

  const now = opts.now();
  return {
    extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
    draftId: `${opts.sourceId}:${acc ? acc.n : 1}`,
    sourceId: opts.sourceId,
    profile,
    fields: f,
    unmappedBlockIds: [],
    createdAtIso: now,
    updatedAtIso: now,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function extractDrafts(doc: ParsedDocument, options: ExtractOptions = {}): ExtractResult {
  const opts: Required<ExtractOptions> = {
    sourceId: options.sourceId ?? 'pasted',
    now: options.now ?? (() => new Date().toISOString()),
  };
  const profile = detectProfile(doc);
  const sections = sectionize(doc.blocks);
  const consumed = new Set<string>();

  const shared: Shared = {
    objectives: null,
    setup: null,
    debriefPoints: null,
    debriefQuestions: null,
    rubricRows: [],
    docTitle: doc.blocks.find((b) => b.kind === 'heading' && b.level === 1) ?? null,
  };

  // Rubric tables anywhere in the document.
  for (const b of doc.blocks) {
    if (b.kind === 'table' && isRubricTable(b)) shared.rubricRows.push(...parseRubricTable(b));
  }

  // Split scenario spans from shared sections.
  const scenarios = new Map<number, ScenarioAccumulator>();
  let current: ScenarioAccumulator | null = null;
  const sharedSections: Section[] = [];
  for (const s of sections) {
    const sn = scenarioNumber(s.heading);
    if (sn) {
      const existing = scenarios.get(sn.n);
      if (existing) {
        current = existing;
        current.sections.push({ heading: null, body: s.body });
      } else {
        current = { n: sn.n, title: sn.title, heading: s.heading as SourceBlock, sections: [{ heading: null, body: s.body }] };
        scenarios.set(sn.n, current);
      }
      continue;
    }
    if (current && !isTerminator(s.heading)) {
      // A heading that looks like a shared section (e.g. "LEARNING OBJECTIVES"
      // after a playbook scenario span) ends the span.
      if (s.heading && s.heading.level !== undefined && current.heading.level !== undefined && s.heading.level < current.heading.level) {
        current = null;
        sharedSections.push(s);
        continue;
      }
      current.sections.push(s);
      continue;
    }
    current = null;
    sharedSections.push(s);
  }

  for (const s of sharedSections) {
    const h = s.heading;
    const text = h?.text ?? '';
    if (h) consumed.add(h.id);
    const prose = s.body.filter((b) => b.kind !== 'table');
    if (!h) continue;
    if (SECTION_BANNER_RE.test(text)) continue;
    if (OBJECTIVES_RE.test(text)) {
      shared.objectives = appendList(shared.objectives, listOrText(prose), h);
      prose.forEach((b) => consumed.add(b.id));
    } else if (DEBRIEF_RE.test(text)) {
      // A debrief section with no questions means "none listed" — that is
      // an extracted empty list, not an unresolved field.
      const { points, questions } = splitQuestions(listOrText(prose));
      shared.debriefPoints = appendList(shared.debriefPoints, points, h) ?? { items: [], block: h };
      shared.debriefQuestions = appendList(shared.debriefQuestions, questions, h) ?? { items: [], block: h };
      prose.forEach((b) => consumed.add(b.id));
    } else if (SETUP_RE.test(text) || ACTIVITY_RE.test(text)) {
      shared.setup = appendList(shared.setup, listOrText(prose), h);
      prose.forEach((b) => consumed.add(b.id));
    } else if (ASSESSMENT_RE.test(text)) {
      // Table rows were routed above; the surrounding prose is a note.
      continue;
    }
  }

  const accs = [...scenarios.values()].sort((a, b) => a.n - b.n);
  const drafts =
    accs.length > 0
      ? accs.map((acc) => buildDraft(acc, shared, consumed, doc, opts, profile))
      : [buildDraft(null, shared, consumed, doc, opts, profile)];

  const unmapped = doc.blocks.filter((b) => !consumed.has(b.id)).map((b) => b.id);
  for (const d of drafts) d.unmappedBlockIds = unmapped;
  return { profile, drafts };
}
