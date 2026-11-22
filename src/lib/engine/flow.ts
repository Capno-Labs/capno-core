import type { Phase, Scenario, ScenarioEvent, SimSnapshot } from './types';

/**
 * The session's pacing budget in seconds: the authored hard slot budget when
 * present, otherwise the library's run-time estimate — resolved here once so
 * every pacing display agrees (maintainer decision: the estimate is a useful
 * default pace signal, the authored budget is the override).
 */
export function sessionBudgetSec(scenario: Scenario): number {
  return scenario.targetDurationSec ?? scenario.estimatedMinutes * 60;
}

/** Where a clock stands against its time budget. */
export interface Pace {
  budgetSec: number;
  /** Time left; 0 once over. */
  remainingSec: number;
  /** Time past the budget; 0 until over. */
  overBySec: number;
  /** `low` = inside the last tenth of the budget; `over` = past it. */
  state: 'ok' | 'low' | 'over';
}

/** Pace of `elapsedSec` against `budgetSec`. Display only — never drives the engine. */
export function paceAgainst(elapsedSec: number, budgetSec: number): Pace {
  const remaining = budgetSec - elapsedSec;
  return {
    budgetSec,
    remainingSec: Math.max(0, remaining),
    overBySec: Math.max(0, -remaining),
    state: remaining < 0 ? 'over' : remaining <= budgetSec * 0.1 ? 'low' : 'ok',
  };
}

/** The whole session against its budget (see sessionBudgetSec). */
export function sessionPace(scenario: Scenario, elapsedSec: number): Pace {
  return paceAgainst(elapsedSec, sessionBudgetSec(scenario));
}

/**
 * Time spent in the current phase, and its pace when the phase has an
 * authored `targetDurationSec`. `phase` is undefined if the snapshot names a
 * phase the scenario does not have.
 */
export function phasePace(
  scenario: Scenario,
  snapshot: Pick<SimSnapshot, 'phaseId' | 'phaseChangedAtSec' | 'elapsedSec'>,
): { phase: Phase | undefined; elapsedInPhaseSec: number; pace: Pace | undefined } {
  const phase = scenario.phases.find((p) => p.id === snapshot.phaseId);
  const elapsedInPhaseSec = Math.max(0, snapshot.elapsedSec - (snapshot.phaseChangedAtSec ?? 0));
  return {
    phase,
    elapsedInPhaseSec,
    pace:
      phase?.targetDurationSec !== undefined
        ? paceAgainst(elapsedInPhaseSec, phase.targetDurationSec)
        : undefined,
  };
}

/** The phase after `currentId` in author order, if there is one. */
export function nextPhase(phases: readonly Phase[], currentId: string): Phase | undefined {
  const i = phases.findIndex((p) => p.id === currentId);
  return i >= 0 ? phases[i + 1] : undefined;
}

/**
 * The next event the instructor is expected to fire: the first unfired event
 * in author order (scenario authors write events in narrative order). Shared
 * by the run screen's "Next up" highlight and its next-event hotkey so the
 * key always fires exactly what the highlight shows.
 *
 * A pinned id (the instructor's "make next" override) wins while that event
 * is unfired — pacing can be re-ordered without moving cards. A pin on a
 * fired or unknown event is inert: author order resumes automatically.
 */
export function nextUnfiredEvent(
  events: readonly ScenarioEvent[],
  firedIds: ReadonlySet<string> | readonly string[],
  pinnedId?: string | null,
): ScenarioEvent | undefined {
  const fired = firedIds instanceof Set ? firedIds : new Set(firedIds);
  if (pinnedId != null && !fired.has(pinnedId)) {
    const pinned = events.find((e) => e.id === pinnedId);
    if (pinned) return pinned;
  }
  return events.find((e) => !fired.has(e.id));
}

/**
 * An id for an event added live during a session: the smallest unused
 * `adhoc-N`. Keeps the lowercase a-z0-9_- id convention and can never
 * collide with authored ids already in the list.
 */
export function adhocEventId(events: readonly ScenarioEvent[]): string {
  const taken = new Set(events.map((e) => e.id));
  let n = 1;
  while (taken.has(`adhoc-${n}`)) n += 1;
  return `adhoc-${n}`;
}

/**
 * How the run screen's Flow rail draws one event:
 * - `done`: fired, and none of its linked actions is still waiting for a
 *   mark — it collapses to one line.
 * - `watching`: fired, with linked actions still to mark — the learners'
 *   response to it is what faculty are looking for right now.
 * - `next`: the event the highlight and the N key point at.
 * - `upcoming`: everything else, one line each.
 *
 * `pendingActions` counts the linked actions the rail is showing (so under
 * "Critical only" a fired event with only non-critical actions left is done).
 */
export type FlowCardState = 'done' | 'watching' | 'next' | 'upcoming';

export function flowCardState(input: {
  fired: boolean;
  isNext: boolean;
  pendingActions: number;
}): FlowCardState {
  if (!input.fired) return input.isNext ? 'next' : 'upcoming';
  return input.pendingActions > 0 ? 'watching' : 'done';
}

/**
 * The label to show for an event's `phaseHint`: the phase's label, or the
 * raw hint when no phase has that id (the hint is free text in the schema).
 */
export function phaseHintLabel(
  phases: readonly Phase[],
  phaseHint: string | undefined,
): string | undefined {
  if (phaseHint === undefined) return undefined;
  return phases.find((p) => p.id === phaseHint)?.label ?? phaseHint;
}

/**
 * How far the case has got, as an index into `phases`: the furthest of the
 * phase the instructor has selected, the phase of any fired event, and the
 * phase of the next event. Phases only advance when the instructor presses
 * the stepper, so the selected phase alone can lag the events — this keeps
 * phase-scoped prompts (the rail's "Also watch for" groups) in step with
 * what has actually happened. -1 when nothing resolves to a phase.
 */
export function flowProgressPhaseIndex(
  phases: readonly Phase[],
  currentPhaseId: string,
  events: readonly ScenarioEvent[],
  firedIds: ReadonlySet<string> | readonly string[],
  next?: ScenarioEvent,
): number {
  const fired = firedIds instanceof Set ? firedIds : new Set(firedIds);
  const indexOf = (id: string | undefined) =>
    id === undefined ? -1 : phases.findIndex((p) => p.id === id);
  let progress = Math.max(indexOf(currentPhaseId), indexOf(next?.phaseHint));
  for (const ev of events) {
    if (fired.has(ev.id)) progress = Math.max(progress, indexOf(ev.phaseHint));
  }
  return progress;
}
