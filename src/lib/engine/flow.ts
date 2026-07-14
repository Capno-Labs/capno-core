import type { ScenarioEvent } from './types';

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
