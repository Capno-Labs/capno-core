import { z } from 'zod';
import { extractJson } from './copilot';
import type { ChatMessage, LlmProvider } from './types';

/**
 * Syllabus intake: one LLM pass that lists the distinct simulation labs a
 * faculty-supplied document describes, so the library's "draft from
 * syllabus" flow can generate a scenario per lab and assemble them into a
 * collection. Extraction only — no clinical invention. Every lab is then
 * drafted through the existing generateScenario pipeline (zod validation,
 * repair loop, ai-generated tag) with the same document as grounding.
 */

export interface SyllabusLab {
  /** Display title for the lab session, taken from the document. */
  title: string;
  /** Distilled generation request naming crisis, patient context, difficulty, training level. */
  prompt: string;
}

export const MAX_LABS = 20;
const DEFAULT_MAX_ATTEMPTS = 3;

export const syllabusLabsSchema = z.object({
  labs: z
    .array(z.object({ title: z.string().min(1), prompt: z.string().min(1) }).passthrough())
    .min(1)
    .max(MAX_LABS),
});

const EXTRACTION_RULES = `You are reading a course syllabus or lab-instruction document for Capno, an anesthesia patient-simulator teaching tool. Identify each DISTINCT simulation lab session or clinical case the document describes.

Output ONLY one JSON document: {"labs": [{"title": "...", "prompt": "..."}]}. No prose, no markdown fences.

Hard rules:
- Extraction only: use crises, patient details, drugs, difficulty, and training levels the document states. Do NOT invent clinical content the document doesn't contain.
- title: a short display name for the session, as the document names it.
- prompt: one paragraph distilling that session into a scenario-generation request — the crisis, patient context, and any stated difficulty or training level.
- One entry per distinct session/case; skip non-simulation items (readings, lectures, exams).
- At most ${MAX_LABS} labs. If the document describes more, keep the first ${MAX_LABS} in document order.`;

export function buildExtractionMessages(documentText: string): ChatMessage[] {
  return [
    { role: 'system', content: EXTRACTION_RULES },
    { role: 'user', content: `DOCUMENT (verbatim):\n"""\n${documentText}\n"""` },
  ];
}

export type ExtractLabsResult =
  | { ok: true; labs: SyllabusLab[]; attempts: number }
  | { ok: false; errors: string[]; attempts: number };

export async function extractSyllabusLabs(
  provider: LlmProvider,
  documentText: string,
  opts?: { maxAttempts?: number; signal?: AbortSignal; onAttempt?: (attempt: number) => void },
): Promise<ExtractLabsResult> {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const messages = buildExtractionMessages(documentText);
  let errors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    opts?.onAttempt?.(attempt);
    let text: string;
    try {
      text = await provider.complete({
        messages,
        jsonMode: true,
        temperature: 0.2,
        maxTokens: 4000,
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
    } catch (e) {
      return {
        ok: false,
        errors: [e instanceof Error ? e.message : 'LLM request failed.'],
        attempts: attempt,
      };
    }

    try {
      const parsed: unknown = JSON.parse(extractJson(text));
      const check = syllabusLabsSchema.safeParse(parsed);
      if (check.success) return { ok: true, labs: check.data.labs, attempts: attempt };
      errors = check.error.issues
        .slice(0, 10)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    } catch (e) {
      errors = [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`];
    }

    messages.push(
      { role: 'assistant', content: text },
      {
        role: 'user',
        content: `The JSON failed validation with these errors:\n${errors
          .map((e) => `- ${e}`)
          .join('\n')}\nReturn the complete corrected JSON document only — no commentary.`,
      },
    );
  }

  return { ok: false, errors, attempts: maxAttempts };
}

/**
 * Make a draft id unique against built-ins, existing custom scenarios, and
 * earlier drafts of the same run — an unrelated custom scenario must never
 * silently gain a version because a draft happened to reuse its id.
 */
export function uniquifyDraftId(id: string, taken: ReadonlySet<string>): string {
  if (!taken.has(id)) return id;
  for (let n = 2; ; n++) {
    const candidate = `${id}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
