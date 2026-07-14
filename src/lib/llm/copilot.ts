import { z } from 'zod';
import type {
  ActionStatus,
  NumericVitals,
  Rhythm,
  Scenario,
  SimSnapshot,
} from '../engine/types';
import { NUMERIC_VITAL_KEYS, RHYTHM_LABELS } from '../engine/types';
import { VITAL_META, clampVital, roundVital } from '../engine/vitals';
import type { ChatMessage, LlmProvider } from './types';

/**
 * Live-sim semantic co-pilot: translates a faculty natural-language request
 * ("SBP to 60s over 2 min, HR 135 sinus tach, fire the anaphylaxis event")
 * into structured commands. The LLM only proposes — everything below is
 * validated/clamped client-side, rendered as chips, and applied by faculty
 * through the existing controller actions. Session lifecycle (start/pause/
 * reset/end) is deliberately NOT exposed to the LLM.
 *
 * The zod schema here is llm-module-private; it reuses the engine's canonical
 * key/rhythm lists so it stays mechanically in sync without touching the
 * scenario schema (engine/schema.ts).
 */

// ── Command types ────────────────────────────────────────────────────────────

export type CopilotCommand =
  | { type: 'set_vital'; key: keyof NumericVitals; target: number; overSec: number }
  | { type: 'set_rhythm'; rhythm: Rhythm }
  | { type: 'trigger_event'; eventId: string }
  | { type: 'set_phase'; phaseId: string }
  | { type: 'mark_action'; actionId: string; status: ActionStatus }
  | { type: 'add_note'; text: string }
  | { type: 'skip_ahead'; sec: number }
  | { type: 'cycle_nibp' };

const MAX_OVER_SEC = 600;
const DEFAULT_OVER_SEC = 3; // matches the controller store's setVital default
const MAX_SKIP_SEC = 600;
const MAX_NOTE_CHARS = 500;

const rhythmValues = Object.keys(RHYTHM_LABELS) as [Rhythm, ...Rhythm[]];
const actionStatusValues = ['pending', 'done', 'delayed', 'missed', 'incorrect'] as const;

const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_vital'),
    key: z.enum(NUMERIC_VITAL_KEYS),
    target: z.number().finite(),
    overSec: z.number().finite().optional(),
  }),
  z.object({ type: z.literal('set_rhythm'), rhythm: z.enum(rhythmValues) }),
  z.object({ type: z.literal('trigger_event'), eventId: z.string() }),
  z.object({ type: z.literal('set_phase'), phaseId: z.string() }),
  z.object({
    type: z.literal('mark_action'),
    actionId: z.string(),
    status: z.enum(actionStatusValues),
  }),
  z.object({ type: z.literal('add_note'), text: z.string() }),
  z.object({ type: z.literal('skip_ahead'), sec: z.number().finite() }),
  z.object({ type: z.literal('cycle_nibp') }),
]);

const responseSchema = z.object({
  commands: z.array(z.unknown()).default([]),
  reply: z.string().optional(),
});

// ── Results ──────────────────────────────────────────────────────────────────

export interface CopilotProposal {
  command: CopilotCommand;
  /** Chip text, built from scenario/engine data — never from LLM prose. */
  label: string;
  warnings: string[];
}

export interface CopilotResult {
  proposals: CopilotProposal[];
  /** Model's own note (e.g. why a request can't be fulfilled). */
  reply?: string;
  /** Parse failures and rejected commands. */
  errors: string[];
}

// ── Prompt assembly ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You translate an anesthesia instructor's natural-language request into structured commands for a patient-simulator training tool. This is a manikin simulation for education; no real patient exists. Respond with ONLY a JSON object, no prose:
{"commands":[...], "reply":"optional short note if something cannot be done"}

Command shapes:
{"type":"set_vital","key":"hr|sbp|dbp|spo2|etco2|rr|temp|depth|agentEt|agentFi","target":<number>,"overSec":<seconds>}
{"type":"set_rhythm","rhythm":"sinus|sinus_brady|sinus_tach|afib|svt|vtach|vfib|pea|asystole"}
{"type":"trigger_event","eventId":"<id from CONTEXT.events>"}
{"type":"set_phase","phaseId":"<id from CONTEXT.phases>"}
{"type":"mark_action","actionId":"<id from CONTEXT.actions>","status":"done|delayed|missed|incorrect|pending"}
{"type":"add_note","text":"<string>"}
{"type":"skip_ahead","sec":<seconds>}
{"type":"cycle_nibp"}

Rules:
- Only use event/phase/action ids that appear in CONTEXT. Never invent ids.
- Prefer trigger_event when the request matches a scripted event's label or description; use set_vital/set_rhythm for ad-hoc changes.
- Durations like "over 2 minutes" map to overSec (seconds). Omitting overSec gives a quick 3-second change; when the instructor wants a gradual or insidious trend, give an explicit overSec (60-180 is typical). Use 0 only when the instructor says instantly.
- "BP of 80/40" means both a sbp and a dbp command; a lone "pressure to 80" means sbp unless context says otherwise.
- Session start/pause/reset/end and alarm silencing are NOT available; if asked, return {"commands":[],"reply":"<explain>"}.
- If the request is ambiguous or impossible, return no commands and explain briefly in reply.`;

/** Compact, id+label-only context so the model can resolve names → ids. */
function buildContext(scenario: Scenario, snapshot: SimSnapshot): string {
  return JSON.stringify({
    status: snapshot.status,
    elapsedSec: Math.round(snapshot.elapsedSec),
    phase: snapshot.phaseId,
    vitals: snapshot.vitals,
    phases: scenario.phases.map((p) => ({ id: p.id, label: p.label })),
    events: scenario.events.map((e) => ({
      id: e.id,
      label: e.label,
      ...(e.description ? { description: e.description } : {}),
      category: e.category,
      fired: snapshot.firedEventIds.includes(e.id),
    })),
    actions: scenario.expectedActions.map((a) => {
      const record = snapshot.actions.find((r) => r.actionId === a.id);
      return { id: a.id, label: a.label, status: record?.status ?? 'pending' };
    }),
  });
}

export function buildCopilotMessages(
  scenario: Scenario,
  snapshot: SimSnapshot,
  input: string,
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `CONTEXT:\n${buildContext(scenario, snapshot)}\n\nREQUEST: ${input}`,
    },
  ];
}

// ── Response parsing + safety layer ─────────────────────────────────────────

/** Pull a JSON document out of a possibly fenced / prose-wrapped response. */
export function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body.trim();
}

function formatVital(key: keyof NumericVitals, value: number): string {
  const meta = VITAL_META[key];
  const num = value.toFixed(meta.decimals);
  return meta.unit ? `${num} ${meta.unit}` : num;
}

function clampWithWarning(
  label: string,
  raw: number,
  min: number,
  max: number,
  warnings: string[],
): number {
  const clamped = Math.min(max, Math.max(min, raw));
  if (clamped !== raw) warnings.push(`${label} ${raw} clamped to ${clamped} (allowed ${min}–${max})`);
  return clamped;
}

/**
 * Validate one raw command against the loaded scenario. Returns a proposal,
 * or a string error when the command must be dropped. All clamping/lookup
 * happens here, before anything is shown to faculty.
 */
function validateCommand(
  raw: unknown,
  scenario: Scenario,
  firedEventIds: readonly string[],
): CopilotProposal | string {
  const parsed = commandSchema.safeParse(raw);
  if (!parsed.success) {
    const kind =
      typeof raw === 'object' && raw !== null && 'type' in raw
        ? String((raw as { type: unknown }).type)
        : JSON.stringify(raw);
    return `Rejected command (${kind}): ${parsed.error.issues
      .map((i) => `${i.path.join('.')} ${i.message}`.trim())
      .join('; ')}`;
  }
  const cmd = parsed.data;
  const warnings: string[] = [];

  switch (cmd.type) {
    case 'set_vital': {
      const meta = VITAL_META[cmd.key];
      const target = roundVital(cmd.key, clampVital(cmd.key, cmd.target));
      if (target !== cmd.target) {
        warnings.push(
          `target ${cmd.target} clamped to ${target} (${meta.label} range ${meta.min}–${meta.max})`,
        );
      }
      const overSec = Math.round(
        clampWithWarning('ramp seconds', cmd.overSec ?? DEFAULT_OVER_SEC, 0, MAX_OVER_SEC, warnings),
      );
      return {
        command: { type: 'set_vital', key: cmd.key, target, overSec },
        label: `${meta.label} → ${formatVital(cmd.key, target)}${
          overSec > 0 ? ` over ${overSec} s` : ' (instant)'
        }`,
        warnings,
      };
    }
    case 'set_rhythm':
      return {
        command: cmd,
        label: `Rhythm → ${RHYTHM_LABELS[cmd.rhythm]}`,
        warnings,
      };
    case 'trigger_event': {
      const event = scenario.events.find((e) => e.id === cmd.eventId);
      if (!event) {
        return `Unknown event "${cmd.eventId}" — available: ${scenario.events
          .map((e) => e.id)
          .join(', ')}`;
      }
      if (firedEventIds.includes(event.id)) warnings.push('already fired — will re-fire');
      return { command: cmd, label: `Fire event: ${event.label}`, warnings };
    }
    case 'set_phase': {
      const phase = scenario.phases.find((p) => p.id === cmd.phaseId);
      if (!phase) {
        return `Unknown phase "${cmd.phaseId}" — available: ${scenario.phases
          .map((p) => p.id)
          .join(', ')}`;
      }
      return { command: cmd, label: `Phase → ${phase.label}`, warnings };
    }
    case 'mark_action': {
      const action = scenario.expectedActions.find((a) => a.id === cmd.actionId);
      if (!action) {
        return `Unknown action "${cmd.actionId}" — available: ${scenario.expectedActions
          .map((a) => a.id)
          .join(', ')}`;
      }
      return { command: cmd, label: `Mark "${action.label}" as ${cmd.status}`, warnings };
    }
    case 'add_note': {
      const text = cmd.text.trim();
      if (!text) return 'Rejected add_note: empty text';
      const capped = text.slice(0, MAX_NOTE_CHARS);
      if (capped.length < text.length) warnings.push('note truncated to 500 characters');
      const preview = capped.length > 60 ? `${capped.slice(0, 60)}…` : capped;
      return { command: { type: 'add_note', text: capped }, label: `Add note: “${preview}”`, warnings };
    }
    case 'skip_ahead': {
      const sec = Math.round(clampWithWarning('skip seconds', cmd.sec, 1, MAX_SKIP_SEC, warnings));
      return { command: { type: 'skip_ahead', sec }, label: `Skip ahead ${sec} s`, warnings };
    }
    case 'cycle_nibp':
      return { command: cmd, label: 'Cycle NIBP now', warnings };
  }
}

/** Pure parser/validator — the unit-test target. */
export function parseCopilotResponse(
  text: string,
  scenario: Scenario,
  firedEventIds: readonly string[] = [],
): CopilotResult {
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(extractJson(text));
  } catch (e) {
    return {
      proposals: [],
      errors: [`Could not parse the AI response as JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  const envelope = responseSchema.safeParse(rawParsed);
  if (!envelope.success) {
    return { proposals: [], errors: ['AI response did not match the expected {commands, reply} shape.'] };
  }

  const proposals: CopilotProposal[] = [];
  const errors: string[] = [];
  for (const raw of envelope.data.commands) {
    const result = validateCommand(raw, scenario, firedEventIds);
    if (typeof result === 'string') errors.push(result);
    else proposals.push(result);
  }

  return {
    proposals,
    ...(envelope.data.reply?.trim() ? { reply: envelope.data.reply.trim() } : {}),
    errors,
  };
}

// ── End-to-end helper + dispatch ─────────────────────────────────────────────

export async function runCopilot(
  provider: LlmProvider,
  scenario: Scenario,
  snapshot: SimSnapshot,
  input: string,
  signal?: AbortSignal,
): Promise<CopilotResult> {
  let text: string;
  try {
    text = await provider.complete({
      messages: buildCopilotMessages(scenario, snapshot, input),
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 2000,
      ...(signal ? { signal } : {}),
    });
  } catch (e) {
    return {
      proposals: [],
      errors: [e instanceof Error ? e.message : 'LLM request failed.'],
    };
  }
  return parseCopilotResponse(text, scenario, snapshot.firedEventIds);
}

/**
 * The subset of controller-store actions the co-pilot may drive. Session
 * lifecycle and alarm silencing are intentionally absent.
 */
export interface CopilotActions {
  setVital(key: keyof NumericVitals, value: number, overSec?: number): void;
  setRhythm(rhythm: Rhythm): void;
  triggerEvent(eventId: string): void;
  setPhase(phaseId: string): void;
  markAction(actionId: string, status: ActionStatus): void;
  addNote(text: string): void;
  skipAhead(sec: number): void;
  cycleNibp(): void;
}

export function applyCopilotCommand(command: CopilotCommand, actions: CopilotActions): void {
  switch (command.type) {
    case 'set_vital':
      actions.setVital(command.key, command.target, command.overSec);
      break;
    case 'set_rhythm':
      actions.setRhythm(command.rhythm);
      break;
    case 'trigger_event':
      actions.triggerEvent(command.eventId);
      break;
    case 'set_phase':
      actions.setPhase(command.phaseId);
      break;
    case 'mark_action':
      actions.markAction(command.actionId, command.status);
      break;
    case 'add_note':
      actions.addNote(command.text);
      break;
    case 'skip_ahead':
      actions.skipAhead(command.sec);
      break;
    case 'cycle_nibp':
      actions.cycleNibp();
      break;
  }
}
