import type {
  ActionRecord,
  CategoryScore,
  ExpectedAction,
  Scenario,
  ScoreReport,
} from './types';

/**
 * Score policy:
 *  - done      → full points
 *  - delayed   → half points (rounded down)
 *  - missed    → 0
 *  - incorrect → 0
 *  - pending   → 0 (treated as missed; the engine marks pending → missed at end)
 *
 * Critical actions additionally surface in `criticalMissed` when not done,
 * regardless of partial credit, so debriefs highlight them explicitly.
 */
export function earnedPoints(action: ExpectedAction, record: ActionRecord | undefined): number {
  switch (record?.status) {
    case 'done':
      return action.points;
    case 'delayed':
      return Math.floor(action.points / 2);
    default:
      return 0;
  }
}

export function scoreSession(scenario: Scenario, records: ActionRecord[]): ScoreReport {
  const byId = new Map(records.map((r) => [r.actionId, r]));
  const actionById = new Map(scenario.expectedActions.map((a) => [a.id, a]));

  const categories: CategoryScore[] = scenario.rubric.map((cat) => {
    let earned = 0;
    let possible = 0;
    for (const actionId of cat.actionIds) {
      const action = actionById.get(actionId);
      if (!action) continue;
      possible += action.points;
      earned += earnedPoints(action, byId.get(actionId));
    }
    return { categoryId: cat.id, label: cat.label, earned, possible };
  });

  // Actions not referenced by any rubric category still count toward totals.
  const categorized = new Set(scenario.rubric.flatMap((c) => c.actionIds));
  let extraEarned = 0;
  let extraPossible = 0;
  for (const action of scenario.expectedActions) {
    if (categorized.has(action.id)) continue;
    extraPossible += action.points;
    extraEarned += earnedPoints(action, byId.get(action.id));
  }
  if (extraPossible > 0) {
    categories.push({
      categoryId: '_uncategorized',
      label: 'Other actions',
      earned: extraEarned,
      possible: extraPossible,
    });
  }

  const earned = categories.reduce((s, c) => s + c.earned, 0);
  const possible = categories.reduce((s, c) => s + c.possible, 0);

  const criticalMissed = scenario.expectedActions.filter(
    (a) => a.critical && byId.get(a.id)?.status !== 'done',
  );
  const criticalDone = scenario.expectedActions.filter(
    (a) => a.critical && byId.get(a.id)?.status === 'done',
  );

  return {
    earned,
    possible,
    percent: possible > 0 ? Math.round((earned / possible) * 100) : 0,
    categories,
    criticalMissed,
    criticalDone,
  };
}
