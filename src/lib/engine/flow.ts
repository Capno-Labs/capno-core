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
