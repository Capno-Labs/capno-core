'use client';

import type { ExpectedAction, RubricCategory } from '@/lib/engine/types';

/**
 * Form editor for the grading rubric. Action membership is a checkbox list
 * over the scenario's expected actions, so unknown-action references cannot
 * be created from the form; stale ids left behind by JSON edits render in
 * red with an unlink button. Point sums are display-only — the scoring
 * policy lives in scoring.ts and is unchanged here.
 */
export function RubricEditor({
  rubric,
  actions,
  onChange,
}: {
  rubric: RubricCategory[];
  actions: ExpectedAction[];
  onChange: (rubric: RubricCategory[]) => void;
}) {
  const patch = (i: number, p: Partial<RubricCategory>) =>
    onChange(rubric.map((c, j) => (j === i ? { ...c, ...p } : c)));

  const actionById = new Map(actions.map((a) => [a.id, a]));

  return (
    <div className="space-y-2">
      {rubric.map((category, i) => {
        const staleIds = category.actionIds.filter((id) => !actionById.has(id));
        const points = category.actionIds.reduce(
          (sum, id) => sum + (actionById.get(id)?.points ?? 0),
          0,
        );
        return (
          <div key={i} className="space-y-2 rounded bg-slate-800/60 p-2">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-2 gap-2">
                <div>
                  <span className="label">Category id (kebab-case)</span>
                  <input
                    className="input font-mono"
                    value={category.id}
                    onChange={(e) => patch(i, { id: e.target.value })}
                  />
                </div>
                <div>
                  <span className="label">Label</span>
                  <input
                    className="input"
                    value={category.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                  />
                </div>
              </div>
              <button
                className="btn-ghost mt-5 shrink-0 !px-2 !py-1 text-red-400"
                onClick={() => onChange(rubric.filter((_, j) => j !== i))}
                aria-label={`remove category ${category.label || i + 1}`}
              >
                ✕
              </button>
            </div>
            <div>
              <span className="label">
                Actions in this category · {points} point{points === 1 ? '' : 's'}
              </span>
              <ul className="space-y-1">
                {actions.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={category.actionIds.includes(a.id)}
                        onChange={(e) =>
                          patch(i, {
                            actionIds: e.target.checked
                              ? [...category.actionIds, a.id]
                              : category.actionIds.filter((id) => id !== a.id),
                          })
                        }
                      />
                      <span>
                        {a.label || a.id}
                        {a.critical && <span title="critical action"> ★</span>}
                      </span>
                      <span className="text-xs text-slate-500">
                        {a.points} pt{a.points === 1 ? '' : 's'}
                      </span>
                    </label>
                  </li>
                ))}
                {staleIds.map((id) => (
                  <li key={id} className="flex items-center gap-2 text-sm text-red-400">
                    <span className="font-mono">{id}</span>
                    <span className="text-xs">— no such action</span>
                    <button
                      className="text-xs underline hover:text-red-300"
                      onClick={() =>
                        patch(i, { actionIds: category.actionIds.filter((x) => x !== id) })
                      }
                    >
                      unlink
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
      <button
        className="btn-secondary"
        onClick={() => onChange([...rubric, { id: '', label: '', actionIds: [] }])}
      >
        + Add rubric category
      </button>
      <p className="text-xs text-slate-500">
        Scoring policy: done = full points, delayed = half, missed/incorrect = 0; critical actions
        are additionally surfaced on the debrief report.
      </p>
    </div>
  );
}
