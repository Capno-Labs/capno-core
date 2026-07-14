import type { Scenario, ScenarioEvent } from './types';

/**
 * The session's pacing budget in seconds: the authored hard slot budget when
 * present, otherwise the library's run-time estimate — resolved here once so
 * every pacing display agrees (maintainer decision: the estimate is a useful
 * default pace signal, the authored budget is the override).
 */
export function sessionBudgetSec(scenario: Scenario): number {
  return scenario.targetDurationSec ?? scenario.estimatedMinutes * 60;
}

/**
 * The next event the instructor is expected to fire: the first unfired event
 * in author order (scenario authors write events in narrative order). Shared
 * by the run screen's "Next up" highlight and its next-event hotkey so the
 * key always fires exactly what the highlight shows.
 */
export function nextUnfiredEvent(
  events: readonly ScenarioEvent[],
  firedIds: ReadonlySet<string> | readonly string[],
): ScenarioEvent | undefined {
  const fired = firedIds instanceof Set ? firedIds : new Set(firedIds);
  return events.find((e) => !fired.has(e.id));
}
