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
