export { BUILT_IN_SCENARIOS, getBuiltInScenario } from './registry';
export { QUICK_START_ID, QUICK_START_SCENARIO } from './quickStart';
export {
  listCustomScenarios,
  getCustomScenario,
  getVersionHistory,
  saveCustomScenario,
  deleteCustomScenario,
} from './customStore';

import { BUILT_IN_SCENARIOS, getBuiltInScenario } from './registry';
import { getCustomScenario, listCustomScenarios } from './customStore';
import { QUICK_START_ID, QUICK_START_SCENARIO } from './quickStart';
import type { Scenario } from '../engine/types';

/** All scenarios visible to this device: built-in library + custom-authored. */
export function listAllScenarios(): Scenario[] {
  const custom = listCustomScenarios();
  const customIds = new Set(custom.map((s) => s.id));
  // A custom scenario with the same id shadows (overrides) a built-in one.
  return [...custom, ...BUILT_IN_SCENARIOS.filter((s) => !customIds.has(s.id))];
}

export function getScenario(id: string): Scenario | undefined {
  return (
    getCustomScenario(id) ??
    getBuiltInScenario(id) ??
    (id === QUICK_START_ID ? QUICK_START_SCENARIO : undefined)
  );
}
