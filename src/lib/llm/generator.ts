import inductionHypotension from '@/scenarios/induction-hypotension.json';
import { DOMAINS } from '../engine/lint';
import { parseScenario, validateScenario } from '../engine/schema';
import type { Scenario } from '../engine/types';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import { extractJson } from './copilot';
import type { ChatMessage, LlmProvider } from './types';

/**
 * AI scenario drafting: prompt → complete Scenario JSON, run through the
 * existing zod `validateScenario` with a bounded repair loop (validation
 * errors are fed back verbatim — they're already human/LLM-readable
 * `path: message` strings). Output is a DRAFT: it lands in the editor's JSON
 * pane for faculty to Apply/review/save via the existing pipeline, tagged
 * `ai-generated` so the library and editor can flag it until reviewed
 * (clinical content is reviewed material — see CLAUDE.md invariant 7).
 */

export const AI_GENERATED_TAG = 'ai-generated';
const DEFAULT_MAX_ATTEMPTS = 3;

/** Ids of the reviewed built-in scenarios a draft must never shadow. */
const BUILT_IN_IDS = BUILT_IN_SCENARIOS.map((s) => s.id);

export type GenerateResult =
  | { ok: true; scenario: Scenario; attempts: number }
  | { ok: false; errors: string[]; rawText: string; attempts: number };

// ── Prompt assembly ──────────────────────────────────────────────────────────

// Condensed from docs/scenario.schema.md — keep in sync when the scenario
// schema changes (same checklist as types.ts/schema.ts, CLAUDE.md invariant 2).
const SCHEMA_REFERENCE = `Scenario JSON structure (all fields required unless marked optional):
{
  "id": "kebab-case, lowercase a-z0-9_-",
  "version": "1.0.0",
  "title": "...", "summary": "...",
  "tags": {
    "topics": ["<domain>", "<crisis name>", "free-form specifics"],  // topics[0]: one curriculum domain (see rules)
    "difficulty": "beginner|intermediate|advanced",
    "trainingLevels": ["medical_student|srna|resident_junior|resident_senior|crna|attending", "at least 1"]
  },
  "learningObjectives": ["at least 1"],
  "setup": ["room/equipment/confederate instructions for faculty"],
  "patient": {
    "name": "...", "age": 0-120, "sex": "male|female", "weightKg": n, "heightCm": n,
    "asa": 1-6, "allergies": [], "medications": [], "pmh": [],
    "airway": { "mallampati": 1-4, "mouthOpeningCm"?: n, "thyromentalCm"?: n,
                "neckMobility"?: "normal|limited|immobile", "dentition"?: "...", "notes"?: "..." },
    "plan"?: "free-text surgical/anesthetic plan"
  },
  "baselineVitals": {
    "hr": 0-300, "sbp": n, "dbp": n, "spo2": 0-100, "etco2": n, "rr": n,
    "temp": 25-45 (Celsius), "depth": 0-100, "agentEt": %, "agentFi": %,
    "rhythm": "sinus|sinus_brady|sinus_tach|pvc|pac|afib|svt|vtach|vfib|pea|asystole",
    "capnoShape"?: "normal|bronchospasm"   // capnograph morphology; default normal
  },
  "phases": [{ "id": "...", "label": "...", "description"?: "..." }],   // ordered phases of care, at least 1
  "events": [{
    "id": "unique", "label": "...", "description"?: "...",
    "category": "physiology|airway|circulation|drug|equipment|surgical|resolution|other",
    "autoAtSec"?: n,               // ONLY for scripted deterioration; omit for faculty-triggered responses
    "effects": [{ "vitals"?: { partial numeric vitals }, "rhythm"?: "...",
                  "capnoShape"?: "normal|bronchospasm",
                  "overSec"?: rampSeconds, "afterSec"?: delaySeconds }]
  }],
  "expectedActions": [{ "id": "...", "label": "...", "description"?: "...",
                        "phase"?: "<existing phase id>", "critical": bool, "points": n }],  // at least 1
  "expectedProgression": ["narrative of the expected clinical course"],
  "correctManagement": ["stepwise correct management"],
  "commonErrors": ["typical learner errors"],
  "debrief": { "points": ["facilitator discussion points"], "questions": ["open-ended questions"] },
  "rubric": [{ "id": "...", "label": "...", "actionIds": ["<existing expectedAction ids>"] }],
  "estimatedMinutes": n,
  "monitoring"?: { "artLine"?: bool, "nibpIntervalSec"?: 15-1800 }   // absent = NIBP cuff every 180 s
}`;

const GENERATOR_RULES = `You author training scenarios for Capno, an anesthesia patient-simulator (manikin) teaching tool. This is simulation authoring for education — no real patient exists. Output ONLY one JSON document matching the structure below. No prose, no markdown fences.

Hard rules:
- All ids lowercase, matching [a-z0-9][a-z0-9_-]*. Event ids unique.
- tags.topics[0] MUST be exactly one curriculum domain: ${DOMAINS.join('|')}. topics[1] should name the crisis (e.g. "anaphylaxis", "myocardial ischemia"); later tags are free-form specifics.
- Every rubric[].actionIds entry MUST be an existing expectedActions id.
- Every expectedActions[].phase (when present) MUST be an existing phases id.
- Deterioration/progression events may use autoAtSec; treatment-response events must NOT (faculty fire them when learners act). Include at least one "resolution"-category event so faculty can reflect successful treatment.
- Keep vitals physiologically coherent and within the stated ranges.
- Write teaching content (learningObjectives, expectedProgression, correctManagement, commonErrors, debrief) in concise clinical language for the stated training level.`;

/**
 * Trim the long teaching-content arrays so the few-shot example teaches
 * structure without blowing the token budget.
 */
export function condenseExample(scenario: Scenario): unknown {
  const cut = (arr: string[]) => (arr.length > 2 ? [...arr.slice(0, 2), '…'] : arr);
  return {
    ...scenario,
    setup: cut(scenario.setup),
    learningObjectives: cut(scenario.learningObjectives),
    expectedProgression: cut(scenario.expectedProgression),
    correctManagement: cut(scenario.correctManagement),
    commonErrors: cut(scenario.commonErrors),
    debrief: {
      points: cut(scenario.debrief.points),
      questions: cut(scenario.debrief.questions),
    },
  };
}

export function buildGeneratorMessages(userPrompt: string): ChatMessage[] {
  const example = JSON.stringify(condenseExample(parseScenario(inductionHypotension)));
  return [
    {
      role: 'system',
      content: `${GENERATOR_RULES}\n\n${SCHEMA_REFERENCE}\n\nExample scenario (teaching-content arrays truncated with "…" — yours must be complete):\n${example}`,
    },
    { role: 'user', content: `Create a scenario: ${userPrompt}` },
  ];
}

export function buildRepairMessage(errors: string[]): ChatMessage {
  return {
    role: 'user',
    content: `The JSON failed validation with these errors:\n${errors
      .map((e) => `- ${e}`)
      .join('\n')}\nReturn the complete corrected JSON document only — no commentary.`,
  };
}

// ── Post-processing ──────────────────────────────────────────────────────────

/** Tag as an unreviewed draft and make sure it can't shadow a built-in. */
export function postProcess(scenario: Scenario): Scenario {
  // Appended, not prepended: topics[0] is the curriculum domain by
  // convention and the draft tag must not displace it.
  const topics = scenario.tags.topics.includes(AI_GENERATED_TAG)
    ? scenario.tags.topics
    : [...scenario.tags.topics, AI_GENERATED_TAG];
  const id = BUILT_IN_IDS.includes(scenario.id) ? `${scenario.id}-ai` : scenario.id;
  return { ...scenario, id, tags: { ...scenario.tags, topics } };
}

// ── Generation loop ──────────────────────────────────────────────────────────

export async function generateScenario(
  provider: LlmProvider,
  userPrompt: string,
  opts?: { maxAttempts?: number; signal?: AbortSignal; onAttempt?: (attempt: number) => void },
): Promise<GenerateResult> {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const messages = buildGeneratorMessages(userPrompt);
  let errors: string[] = [];
  let raw = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    opts?.onAttempt?.(attempt);
    let text: string;
    try {
      text = await provider.complete({
        messages,
        jsonMode: true,
        temperature: 0.7,
        maxTokens: 8000,
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
    } catch (e) {
      return {
        ok: false,
        errors: [e instanceof Error ? e.message : 'LLM request failed.'],
        rawText: raw,
        attempts: attempt,
      };
    }

    raw = extractJson(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
      const check = validateScenario(parsed);
      if (check.ok) {
        return { ok: true, scenario: postProcess(parseScenario(parsed)), attempts: attempt };
      }
      errors = check.errors;
    } catch (e) {
      errors = [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`];
    }

    messages.push({ role: 'assistant', content: text }, buildRepairMessage(errors));
  }

  return { ok: false, errors, rawText: raw, attempts: maxAttempts };
}
